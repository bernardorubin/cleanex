import ExpoModulesCore
import Photos
import Vision
import UIKit
import AVKit

public class PhotoScanModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoScan")

    Function("getPhotoPermission") { () -> String in
      return Self.describe(PHPhotoLibrary.authorizationStatus(for: .readWrite))
    }

    AsyncFunction("requestPhotoPermission") { (promise: Promise) in
      PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
        promise.resolve(Self.describe(status))
      }
    }

    // MARK: - Phase 1: fast metadata inventory

    AsyncFunction("inventory") { () -> [String: Any] in
      let started = Date()

      let options = PHFetchOptions()
      options.includeHiddenAssets = false
      let fetched = PHAsset.fetchAssets(with: options)

      var assets: [[String: Any]] = []
      assets.reserveCapacity(fetched.count)

      fetched.enumerateObjects { asset, _, _ in
        let resources = PHAssetResource.assetResources(for: asset)

        // `fileSize` is an undocumented KVC key on PHAssetResource. It is what
        // every cleaner app uses and it passes review, but if it ever returns
        // nothing we fall back to a dimension/duration estimate so the app
        // still ranks largest-first correctly.
        var bytes: Int64 = 0
        for resource in resources {
          if let value = resource.value(forKey: "fileSize") as? NSNumber {
            bytes += value.int64Value
          }
        }
        if bytes == 0 {
          bytes = Self.estimateBytes(asset)
        }

        let subtype: String
        if asset.mediaType == .video {
          subtype = asset.mediaSubtypes.contains(.videoScreenRecording)
            ? "screenRecording" : "video"
        } else {
          subtype = asset.mediaSubtypes.contains(.photoScreenshot)
            ? "screenshot" : "photo"
        }

        assets.append([
          "id": asset.localIdentifier,
          "sizeBytes": bytes,
          "width": asset.pixelWidth,
          "height": asset.pixelHeight,
          "durationSeconds": asset.duration,
          "createdAt": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
          "subtype": subtype,
          "isCameraOriginal": Self.isCameraOriginal(resources),
          "isFavorite": asset.isFavorite,
        ])
      }

      return [
        "assets": assets,
        "elapsedMs": Date().timeIntervalSince(started) * 1000,
      ]
    }

    // MARK: - Phase 2: Vision similarity

    /// Returns asset id pairs whose feature-print distance is below the
    /// threshold. Feature print vectors themselves never cross the bridge —
    /// they are several KB each and a large library would be hundreds of MB.
    AsyncFunction("findSimilarPairs") { (assetIds: [String]) -> [String: Any] in
      let started = Date()

      let fetched = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
      var assets: [PHAsset] = []
      fetched.enumerateObjects { asset, _, _ in assets.append(asset) }
      assets.sort {
        ($0.creationDate ?? .distantPast) < ($1.creationDate ?? .distantPast)
      }

      // Near-duplicates are overwhelmingly shots taken seconds apart, so only
      // assets clustered in time are feature-printed at all. Buckets are capped
      // because comparison is O(n^2) within a bucket and one long burst would
      // otherwise dominate the whole scan.
      var buckets: [[PHAsset]] = []
      var current: [PHAsset] = []
      for asset in assets {
        var split = current.count >= Self.maxBucketSize
        if !split, let last = current.last,
           let a = last.creationDate, let b = asset.creationDate {
          split = b.timeIntervalSince(a) > Self.bucketWindowSeconds
        }
        if split {
          if current.count > 1 { buckets.append(current) }
          current = []
        }
        current.append(asset)
      }
      if current.count > 1 { buckets.append(current) }

      var pairs: [[String]] = []
      var compared = 0

      for bucket in buckets {
        var prints: [(id: String, observation: VNFeaturePrintObservation)] = []
        prints.reserveCapacity(bucket.count)
        for asset in bucket {
          if let print = Self.featurePrint(for: asset) {
            prints.append((asset.localIdentifier, print))
          }
        }

        guard prints.count > 1 else { continue }

        for i in 0..<prints.count {
          for j in (i + 1)..<prints.count {
            var distance = Float(0)
            try? prints[j].observation.computeDistance(&distance, to: prints[i].observation)
            compared += 1
            if distance < Self.similarityThreshold {
              pairs.append([prints[i].id, prints[j].id])
            }
          }
        }
      }

      return [
        "pairs": pairs,
        "elapsedMs": Date().timeIntervalSince(started) * 1000,
        "comparedCount": compared,
      ]
    }

    // MARK: - Deletion

    /// Deletes in one batch so iOS shows a single confirmation sheet rather
    /// than one per photo. Resolves `false` when the user cancels that sheet —
    /// cancelling is a normal outcome, not an error.
    AsyncFunction("deleteAssets") { (assetIds: [String], promise: Promise) in
      let fetched = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
      guard fetched.count > 0 else {
        promise.resolve(["deleted": false, "count": 0])
        return
      }

      PHPhotoLibrary.shared().performChanges {
        PHAssetChangeRequest.deleteAssets(fetched)
      } completionHandler: { success, _ in
        promise.resolve([
          "deleted": success,
          "count": success ? fetched.count : 0,
        ])
      }
    }

    // MARK: - Playback

    /// Presents the system player — the same one the user already knows from
    /// the Photos app. Recognition is the whole accessibility strategy here, so
    /// a bespoke player would be a downgrade even if it were less work.
    AsyncFunction("playVideo") { (assetId: String, promise: Promise) in
      DispatchQueue.main.async {
        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
        guard let asset = fetched.firstObject, asset.mediaType == .video else {
          promise.resolve(false)
          return
        }

        let options = PHVideoRequestOptions()
        options.deliveryMode = .automatic
        // The one place network access is allowed. This fetches the user's own
        // video from their own iCloud library because they tapped it. Without
        // it, every video fails to play on an optimized-storage phone.
        options.isNetworkAccessAllowed = true

        PHImageManager.default().requestPlayerItem(
          forVideo: asset,
          options: options
        ) { item, _ in
          DispatchQueue.main.async {
            guard let item, let top = Self.topViewController() else {
              promise.resolve(false)
              return
            }

            let player = AVPlayer(playerItem: item)
            let controller = AVPlayerViewController()
            controller.player = player

            top.present(controller, animated: true) { player.play() }
            promise.resolve(true)
          }
        }
      }
    }
  }

  // MARK: - Tuning constants

  /// Photos taken more than this far apart are never compared.
  private static let bucketWindowSeconds: TimeInterval = 300

  /// Hard cap on bucket size. Comparison is O(n^2) within a bucket.
  private static let maxBucketSize = 50

  /// Vision feature print distance below which two images are "similar".
  /// 0.35 is the commonly used starting point; tune against real results.
  private static let similarityThreshold: Float = 0.35

  // MARK: - Helpers

  private static func describe(_ status: PHAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "granted"
    case .limited: return "limited"
    case .denied, .restricted: return "denied"
    case .notDetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }

  /// The frontmost presented controller. Presenting on the root while a sheet
  /// is already up silently does nothing, so walk the chain first.
  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }

    guard var top = scene?.keyWindow?.rootViewController else { return nil }
    while let presented = top.presentedViewController { top = presented }
    return top
  }

  /// Photos captured by this device's camera are named `IMG_1234.HEIC`.
  /// Anything saved from another app keeps whatever name that app gave it —
  /// WhatsApp on iOS assigns random alphanumeric or UUID-style names
  /// (`AJXQ8273.JPG`, `7d3cd6be-….jpeg`), AirDrops and downloads keep their own.
  ///
  /// Note: `IMG-20240115-WA0001.jpg` is the *Android* WhatsApp pattern and does
  /// not appear on iOS. There is no "WhatsApp" album on iOS either.
  ///
  /// This is a filename heuristic, not proof. It is deliberately chosen over
  /// reading EXIF headers: that needs a second undocumented KVC key for the
  /// file URL and decodes every image, which is far slower for a signal that
  /// only ever drives a "worth a look" bucket.
  private static func isCameraOriginal(_ resources: [PHAssetResource]) -> Bool {
    guard let filename = resources.first?.originalFilename else { return false }
    let name = (filename as NSString).deletingPathExtension.uppercased()

    // IMG_1234 (iPhone), DSC01234 / DSCF1234 (imported cameras).
    let patterns = ["^IMG_\\d+$", "^DSC[A-Z]?\\d+$"]
    return patterns.contains { pattern in
      name.range(of: pattern, options: .regularExpression) != nil
    }
  }

  private static func estimateBytes(_ asset: PHAsset) -> Int64 {
    if asset.mediaType == .video {
      // ~8 Mbit/s is a reasonable middle for iPhone capture.
      return Int64(asset.duration * 1_000_000)
    }
    // HEIC lands near 0.3 bytes/pixel in practice.
    let pixels = Int64(asset.pixelWidth) * Int64(asset.pixelHeight)
    return max(pixels * 3 / 10, 50_000)
  }

  /// Small thumbnails are enough for a feature print and far faster than
  /// decoding full-resolution originals. Network access is disabled so an
  /// iCloud-optimized library never stalls the scan on downloads.
  private static func featurePrint(for asset: PHAsset) -> VNFeaturePrintObservation? {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.deliveryMode = .fastFormat
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = false

    var image: UIImage?
    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: 224, height: 224),
      contentMode: .aspectFit,
      options: options
    ) { result, _ in image = result }

    guard let cgImage = image?.cgImage else { return nil }

    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])
    return request.results?.first as? VNFeaturePrintObservation
  }
}
