Pod::Spec.new do |s|
  s.name           = 'PhotoScan'
  s.version        = '1.0.0'
  s.summary        = 'On-device photo library inventory and similarity via PhotoKit + Vision.'
  s.description    = 'Byte sizes, subtypes and Vision feature-print pair detection for the photo library.'
  s.author         = ''
  s.homepage       = 'https://github.com/bernardorubin/make-room'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
