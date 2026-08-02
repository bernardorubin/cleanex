import ExpoModulesCore
import Photos
import Vision
import UIKit
import AVKit
import AVFoundation
import CoreLocation

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

        // If the measurement comes back empty we fall back to a
        // dimension/duration estimate so the app still ranks largest-first
        // correctly. An estimate is fine here — it only orders a list. It is
        // never allowed into a transform receipt, which is why the transforms
        // below refuse rather than fall back.
        var bytes = Self.measuredBytes(resources)
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
          // Exact, not a heuristic: PhotoKit records the subtype at capture.
          // So the Live Photo count and byte total can be stated as fact.
          "isLivePhoto": asset.mediaSubtypes.contains(.photoLive),
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

    // MARK: - Transforms

    /// Re-encodes a video smaller and puts the result in the library in place
    /// of the original.
    ///
    /// "In place of" is doing a lot of work there: PhotoKit has no request that
    /// replaces an asset's data, so this is export → create → delete. A created
    /// asset starts blank, which means creation date, location, favourite
    /// status and album membership are carried across by hand. Losing any of
    /// them is a bug, not a tradeoff — a holiday video that jumps to today's
    /// date reads as the app breaking the user's library.
    ///
    /// Resolves `ok: false` for every ordinary failure: unknown preset, asset
    /// gone, not a video, slo-mo or time-lapse, unmeasurable original, another
    /// transform already running, iCloud fetch or export failed, the user
    /// cancelled the system delete sheet, or the re-encode came out no smaller
    /// than what it would replace. None of those are exceptional and none of
    /// them throw.
    AsyncFunction("compressVideo") { (assetId: String, preset: String, promise: Promise) in
      Self.compressVideo(assetId: assetId, preset: preset, promise: promise)
    }

    /// Keeps a Live Photo's still image and drops the video beside it, which is
    /// the photo the user thought they were taking in the first place.
    ///
    /// The still is copied out byte for byte rather than re-encoded, so there
    /// is no quality loss at all here — only the ~3s of video goes.
    ///
    /// Same create-then-delete path, same hand-carried metadata, same
    /// `ok: false` on every ordinary failure as `compressVideo`.
    AsyncFunction("flattenLivePhoto") { (assetId: String, promise: Promise) in
      Self.flattenLivePhoto(assetId: assetId, promise: promise)
    }

    /// Stops the transform that is running, if any. Resolves `false` when there
    /// was nothing to stop.
    ///
    /// This is not a nicety. Both transforms may have to pull the full-size
    /// original down from iCloud first, and PhotoKit puts no timeout on that:
    /// on a slow connection it simply does not call back. Without a way out the
    /// user sits on a spinner forever.
    AsyncFunction("cancelTransform") { () -> Bool in
      return Self.job.cancel()
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

            // Without this the app runs under the default .soloAmbient
            // category, which the hardware ringer switch silences — the user
            // taps a video, watches it play, and hears nothing, with no reason
            // on screen why. .playback is what the Photos app itself uses.
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playback, mode: .moviePlayback)
            try? session.setActive(true)

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

  // MARK: - Transform implementation

  /// The one transform allowed to be in flight, and the handles to cancel it.
  private static let job = TransformJob()

  private static func compressVideo(assetId: String, preset: String, promise: Promise) {
    let outcome = TransformOutcome(promise)

    guard let presetName = Self.exportPreset(for: preset) else {
      outcome.fail()
      return
    }

    let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetched.firstObject, asset.mediaType == .video else {
      outcome.fail()
      return
    }

    // Slo-mo and time-lapse are not ordinary videos: the playback rate lives in
    // the asset's structure, not in the frames, and a plain re-encode flattens
    // them into a file that plays at the wrong speed. TypeScript filters what
    // it can from metadata, but only the subtype flags settle it — so the last
    // word is here, and it is a refusal rather than a corrupted file.
    if asset.mediaSubtypes.contains(.videoHighFrameRate)
      || asset.mediaSubtypes.contains(.videoTimelapse) {
      outcome.fail()
      return
    }

    // Never report an estimate as a result. If the original cannot be measured
    // there is no truthful before-figure to print, so the transform does not
    // run at all rather than produce a receipt with a guess on it.
    let oldBytes = Self.measuredBytes(of: asset)
    guard oldBytes > 0 else {
      outcome.fail()
      return
    }

    guard let token = Self.job.begin() else {
      outcome.fail(oldBytes: oldBytes)
      return
    }

    let options = PHVideoRequestOptions()
    options.version = .current
    // Not `.automatic`: that can hand back a degraded stand-in when the
    // original is not on device, and re-encoding a stand-in would replace a
    // good original with a compressed copy of a bad one.
    options.deliveryMode = .highQualityFormat
    // Required, not optional. On a phone with Optimize iPhone Storage the
    // full-size original lives in iCloud and there is nothing local to export;
    // without this every such video fails. The cost is that this call can take
    // minutes on a slow connection, with no timeout of its own — see
    // `cancelTransform`, which is the only way out of it.
    options.isNetworkAccessAllowed = true

    let requestID = PHImageManager.default().requestExportSession(
      forVideo: asset,
      options: options,
      exportPreset: presetName
    ) { session, _ in
      // Arbitrary queue. Nothing below touches UIKit, so unlike `playVideo`
      // there is deliberately no hop to the main thread anywhere in a
      // transform — `performChanges` presents its own sheet from wherever it
      // is called.
      guard let session, !Self.job.isCancelled(token: token) else {
        Self.job.finish(token: token)
        outcome.fail(oldBytes: oldBytes)
        return
      }

      let output = Self.temporaryURL(withExtension: "mov")
      session.outputURL = output
      session.outputFileType = .mov
      session.shouldOptimizeForNetworkUse = true
      // `metadataItemFilter` is deliberately left unset. Setting it to
      // `.forSharing()` strips the capture location, which this transform is
      // required to preserve.

      Self.job.track(session: session, token: token)

      session.exportAsynchronously {
        // Arbitrary queue again. The cancellation check is repeated here: a
        // cancel that lands in the moment the encode finishes still means the
        // user does not want their original deleted, and the encode is the
        // cheap half to throw away.
        guard session.status == .completed, !Self.job.isCancelled(token: token) else {
          try? FileManager.default.removeItem(at: output)
          Self.job.finish(token: token)
          outcome.fail(oldBytes: oldBytes)
          return
        }

        let newBytes = Self.fileBytes(output)

        // A short clip, or one already smaller than the preset's ceiling, can
        // re-encode *larger* than it started. Going through with that would
        // spend quality and storage at once, so keep the original and hand
        // back both measured figures so the caller can say why nothing changed.
        guard newBytes > 0, newBytes < oldBytes else {
          try? FileManager.default.removeItem(at: output)
          Self.job.finish(token: token)
          outcome.resolve(ok: false, newAssetId: nil, oldBytes: oldBytes, newBytes: newBytes)
          return
        }

        Self.replace(
          original: asset,
          withFileAt: output,
          resourceType: .video,
          originalFilename: nil,
          oldBytes: oldBytes,
          fallbackNewBytes: newBytes,
          token: token,
          outcome: outcome
        )
      }
    }

    Self.job.track(requestID: requestID, token: token)
  }

  private static func flattenLivePhoto(assetId: String, promise: Promise) {
    let outcome = TransformOutcome(promise)

    let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
    guard let asset = fetched.firstObject,
          asset.mediaType == .image,
          asset.mediaSubtypes.contains(.photoLive) else {
      outcome.fail()
      return
    }

    let resources = PHAssetResource.assetResources(for: asset)

    // `.fullSizePhoto` is the rendered still of an *edited* Live Photo;
    // `.photo` is the untouched original. Taking `.photo` from an edited asset
    // would quietly discard the user's edits, so the rendered version wins
    // where it exists.
    guard let still = resources.first(where: { $0.type == .fullSizePhoto })
            ?? resources.first(where: { $0.type == .photo }) else {
      outcome.fail()
      return
    }

    // Every resource, so this is the whole current cost — still plus the paired
    // video that is about to go. Same rule as compression: no measurement, no
    // transform.
    let oldBytes = Self.measuredBytes(resources)
    guard oldBytes > 0 else {
      outcome.fail()
      return
    }

    guard let token = Self.job.begin() else {
      outcome.fail(oldBytes: oldBytes)
      return
    }

    let ext = (still.originalFilename as NSString).pathExtension
    let output = Self.temporaryURL(withExtension: ext.isEmpty ? "heic" : ext)

    let options = PHAssetResourceRequestOptions()
    // Same reasoning, and the same unbounded wait, as compression: with
    // Optimize iPhone Storage even the still may only exist in iCloud.
    options.isNetworkAccessAllowed = true

    // Copying the resource rather than re-rendering the image is the whole
    // point: the bytes that land in the library are the bytes Apple's camera
    // wrote, EXIF and all. Nothing is recompressed.
    let requestID = PHAssetResourceManager.default().writeData(
      for: still,
      toFile: output,
      options: options
    ) { error in
      // Arbitrary queue.
      let newBytes = Self.fileBytes(output)
      guard error == nil, newBytes > 0, !Self.job.isCancelled(token: token) else {
        try? FileManager.default.removeItem(at: output)
        Self.job.finish(token: token)
        outcome.fail(oldBytes: oldBytes)
        return
      }

      Self.replace(
        original: asset,
        withFileAt: output,
        resourceType: .photo,
        originalFilename: still.originalFilename,
        oldBytes: oldBytes,
        fallbackNewBytes: newBytes,
        token: token,
        outcome: outcome
      )
    }

    Self.job.track(resourceRequestID: requestID, token: token)
  }

  /// The create-then-delete half both transforms share: put the produced file
  /// in the library carrying the original's identity, then remove the original.
  ///
  /// Creation and deletion go in **one** change block on purpose. PhotoKit
  /// applies a block all or nothing, so if the user taps Cancel on the system
  /// delete sheet the library is left exactly as it was — rather than holding
  /// both copies, which would mean the app that promised to free space just
  /// used more of it. It is also one sheet instead of two.
  private static func replace(
    original: PHAsset,
    withFileAt url: URL,
    resourceType: PHAssetResourceType,
    originalFilename: String?,
    oldBytes: Int64,
    fallbackNewBytes: Int64,
    token: Int,
    outcome: TransformOutcome
  ) {
    // A created asset belongs to no album, so album membership only survives if
    // it is re-applied by hand. `fetchAssetCollectionsContaining` finds the
    // user's own albums; smart albums are excluded because they re-evaluate
    // themselves from their own rules, and any album that refuses edits (an
    // iCloud shared album, most often) is skipped rather than failing the whole
    // transform.
    let containing = PHAssetCollection.fetchAssetCollectionsContaining(
      original,
      with: .album,
      options: nil
    )
    var albums: [PHAssetCollection] = []
    containing.enumerateObjects { album, _, _ in
      if album.canPerform(.addContent) { albums.append(album) }
    }

    var placeholder: PHObjectPlaceholder?

    PHPhotoLibrary.shared().performChanges {
      let creation = PHAssetCreationRequest.forAsset()

      let resourceOptions = PHAssetResourceCreationOptions()
      // Move rather than copy: this runs on a phone that is by definition short
      // of space, and a copy would need the file twice over mid-transform. The
      // completion handler removes the source either way.
      resourceOptions.shouldMoveFile = true
      if let originalFilename {
        resourceOptions.originalFilename = originalFilename
      }
      creation.addResource(with: resourceType, fileURL: url, options: resourceOptions)

      // The hand-carried identity. Everything the user would notice missing.
      creation.creationDate = original.creationDate
      creation.location = original.location
      creation.isFavorite = original.isFavorite

      guard let created = creation.placeholderForCreatedAsset else { return }
      placeholder = created

      for album in albums {
        PHAssetCollectionChangeRequest(for: album)?.addAssets([created] as NSArray)
      }

      PHAssetChangeRequest.deleteAssets([original] as NSArray)
    } completionHandler: { success, _ in
      // Arbitrary queue.
      try? FileManager.default.removeItem(at: url)
      Self.job.finish(token: token)

      guard success, let newId = placeholder?.localIdentifier else {
        // Cancelling the delete sheet lands here. Nothing was changed and
        // nothing failed — it is an ordinary outcome, exactly as in
        // `deleteAssets`.
        outcome.fail(oldBytes: oldBytes)
        return
      }

      // Prefer what the library says it stored over the size of the file handed
      // to it. The two should agree; where they ever disagree, the library's
      // figure is the one the user's free space actually reflects.
      let stored = Self.measuredBytes(withLocalIdentifier: newId)
      outcome.resolve(
        ok: true,
        newAssetId: newId,
        oldBytes: oldBytes,
        newBytes: stored > 0 ? stored : fallbackNewBytes
      )
    }
  }

  /// Named by outcome rather than by resolution, because the audience does not
  /// know what 1080p means. `nil` for anything unrecognised — a typo must not
  /// silently re-encode at a quality nobody chose.
  private static func exportPreset(for name: String) -> String? {
    switch name {
    case "sharp": return AVAssetExportPreset1920x1080
    case "phone": return AVAssetExportPreset1280x720
    case "smallest": return AVAssetExportPreset960x540
    default: return nil
    }
  }

  /// Real bytes, summed across an asset's resources, or 0 when PhotoKit will
  /// not say. Never an estimate — `estimateBytes` orders a list, this measures
  /// a result, and the two must not be confused.
  private static func measuredBytes(_ resources: [PHAssetResource]) -> Int64 {
    // `fileSize` is an undocumented KVC key on PHAssetResource. It is what
    // every cleaner app uses and it passes review.
    var bytes: Int64 = 0
    for resource in resources {
      if let value = resource.value(forKey: "fileSize") as? NSNumber {
        bytes += value.int64Value
      }
    }
    return bytes
  }

  private static func measuredBytes(of asset: PHAsset) -> Int64 {
    return measuredBytes(PHAssetResource.assetResources(for: asset))
  }

  private static func measuredBytes(withLocalIdentifier id: String) -> Int64 {
    let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil)
    guard let asset = fetched.firstObject else { return 0 }
    return measuredBytes(of: asset)
  }

  private static func fileBytes(_ url: URL) -> Int64 {
    let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
    return (attributes?[.size] as? NSNumber)?.int64Value ?? 0
  }

  private static func temporaryURL(withExtension ext: String) -> URL {
    return FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(ext)
  }
}

// MARK: - Transform plumbing

/// Resolves a transform's promise at most once.
///
/// The outcome is decided inside one of three nested PhotoKit callbacks, each
/// of which can also be the one that fails. Resolving twice crashes the bridge
/// and resolving zero times hangs the caller forever, so the guard lives here
/// rather than being re-argued at every `return`.
private final class TransformOutcome {
  private let promise: Promise
  private let lock = NSLock()
  private var sent = false

  init(_ promise: Promise) {
    self.promise = promise
  }

  func resolve(ok: Bool, newAssetId: String?, oldBytes: Int64, newBytes: Int64) {
    lock.lock()
    if sent {
      lock.unlock()
      return
    }
    sent = true
    lock.unlock()

    var payload: [String: Any] = [
      "ok": ok,
      "oldBytes": oldBytes,
      "newBytes": newBytes,
      "newAssetId": NSNull(),
    ]
    if let newAssetId {
      payload["newAssetId"] = newAssetId
    }
    promise.resolve(payload)
  }

  /// `oldBytes` is carried through failures where it is already known, so the
  /// caller can still say what the file weighs even when nothing was done to it.
  func fail(oldBytes: Int64 = 0) {
    resolve(ok: false, newAssetId: nil, oldBytes: oldBytes, newBytes: 0)
  }
}

/// Serialises transforms and holds the handles needed to cancel the running one.
///
/// One at a time, deliberately: every change block that deletes an asset the
/// app did not create raises a system confirmation sheet, and overlapping
/// transforms would stack sheets on each other.
///
/// The token is what keeps a late callback from a finished or cancelled
/// transform from clearing the handles of the next one. `cancel` frees the slot
/// immediately rather than waiting for the callback, because the whole reason
/// cancellation exists is that the callback may never come.
private final class TransformJob {
  private let lock = NSLock()
  private var token = 0
  private var running = false
  private var cancelled = false
  private var imageRequestID: Int32 = 0
  private var resourceRequestID: Int32 = 0
  private var session: AVAssetExportSession?

  /// The token for the new job, or `nil` when one is already running.
  func begin() -> Int? {
    lock.lock()
    defer { lock.unlock() }
    if running { return nil }
    running = true
    cancelled = false
    imageRequestID = 0
    resourceRequestID = 0
    session = nil
    token += 1
    return token
  }

  func track(requestID id: Int32, token t: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard running, token == t else { return }
    imageRequestID = id
  }

  func track(resourceRequestID id: Int32, token t: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard running, token == t else { return }
    resourceRequestID = id
  }

  func track(session s: AVAssetExportSession, token t: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard running, token == t else { return }
    session = s
  }

  func isCancelled(token t: Int) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return token != t || cancelled
  }

  func finish(token t: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard token == t else { return }
    running = false
    cancelled = false
    imageRequestID = 0
    resourceRequestID = 0
    session = nil
  }

  /// `false` when there was nothing running to cancel.
  func cancel() -> Bool {
    lock.lock()
    guard running, !cancelled else {
      lock.unlock()
      return false
    }
    cancelled = true
    running = false
    let imageID = imageRequestID
    let resourceID = resourceRequestID
    let exportSession = session
    imageRequestID = 0
    resourceRequestID = 0
    session = nil
    lock.unlock()

    // Cancelling makes PhotoKit call the pending handler back with no result,
    // which is how the promise still resolves instead of being abandoned.
    if imageID != 0 {
      PHImageManager.default().cancelImageRequest(imageID)
    }
    if resourceID != 0 {
      PHAssetResourceManager.default().cancelDataRequest(resourceID)
    }
    exportSession?.cancelExport()
    return true
  }
}
