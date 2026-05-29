import type { CameraPosition } from '../specs/common-types/CameraPosition'
import type { DeviceType } from '../specs/common-types/DeviceType'
import type { CameraDevice } from '../specs/inputs/CameraDevice.nitro'

export type PhysicalDeviceType = Extract<
  DeviceType,
  | 'ultra-wide-angle'
  | 'wide-angle'
  | 'telephoto'
  | 'true-depth'
  | 'lidar-depth'
  | 'time-of-flight-depth'
  | 'external'
  | 'continuity'
>

export interface DeviceFilter {
  /**
   * The desired physical devices your camera device should have.
   *
   * Many modern phones have multiple Camera devices on one side and can combine those physical camera devices to one logical camera device.
   * For example, the iPhone 11 has two physical camera devices, the `ultra-wide-angle` ("fish-eye") and the normal `wide-angle`.
   * You can either use one of those devices individually, or use a combined logical camera device which can smoothly switch over between the two physical cameras depending on the current `zoom` level.
   * When the user is at 0.5x-1x zoom, the `ultra-wide-angle` can be used to offer a fish-eye zoom-out effect, and anything above 1x will smoothly switch over to the `wide-angle`.
   *
   * @note Devices with fewer physical devices (`['wide-angle']`) are usually faster to start up than more complex
   * devices (`['ultra-wide-angle', 'wide-angle', 'telephoto']`), but don't offer zoom switch-over capabilities.
   *
   * @example
   * ```ts
   * // This device is simpler, so it starts up faster.
   * getCameraDevice({ physicalDevices: ['wide-angle'] })
   * // This device is more complex, so it starts up slower, but you can switch between devices on 0.5x, 1x and 2x zoom.
   * getCameraDevice({ physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'] })
   * ```
   */
  physicalDevices?: PhysicalDeviceType[]
  /**
   * Whether the camera device must support depth data capture.
   *
   * On iOS, depth-capable devices include:
   * - Back LiDAR cameras (`'lidar-depth'`) on iPhone 12 Pro and newer.
   * - Front TrueDepth cameras (`'true-depth'`) on Face ID-equipped iPhones.
   *
   * On Android, depth-capable devices include Time-of-Flight (ToF) sensors.
   *
   * When `true`, only devices whose {@linkcode CameraDevice.mediaTypes | mediaTypes}
   * includes `'depth'` are considered.
   *
   * @default false
   * @example
   * ```ts
   * // Get a back camera that supports depth / LiDAR streaming
   * const device = getCameraDevice(devices, 'back', {
   *   requiresDepthCapture: true,
   * })
   * ```
   */
  requiresDepthCapture?: boolean
}

/**
 * Returns whether the given {@linkcode CameraDevice} supports depth data capture.
 *
 * This is a convenience helper equivalent to `device.mediaTypes.includes('depth')`.
 *
 * On iOS, depth-capable devices include back LiDAR cameras (iPhone 12 Pro+) and
 * front TrueDepth cameras (Face ID iPhones).
 * On Android, depth-capable devices include Time-of-Flight (ToF) sensors.
 *
 * @param device The {@linkcode CameraDevice} to check.
 * @returns `true` if the device supports depth capture, `false` otherwise.
 * @example
 * ```ts
 * if (supportsDepthCapture(device)) {
 *   console.log('This device can stream depth frames!')
 * }
 * ```
 */
export function supportsDepthCapture(device: CameraDevice): boolean {
  return device.mediaTypes.includes('depth')
}

/**
 * Get the best matching Camera device that best satisfies your requirements using a sorting filter,
 * or `undefined` if not Cameras are available on this platform.
 *
 * If this platform has any Cameras at the given {@linkcode position}, this method will always return
 * a Camera device, so {@linkcode filter} never excludes cameras.
 *
 * @param position The position of the Camera device relative to the phone.
 * @param filter The filter you want to use. The Camera device that matches your filter the closest will be returned
 * @returns The Camera device that matches your filter the closest, or `undefined` if no Camera Device exists on this platform.
 * @example
 * ```ts
 * const device = getCameraDevice(devices, 'back', {
 *    physicalDevices: ['wide-angle']
 * })
 * ```
 */
export function getCameraDevice(
  devices: CameraDevice[],
  position: CameraPosition,
  filter: DeviceFilter = {},
): CameraDevice | undefined {
  return devices
    .filter((d) => {
      if (d.position !== position) return false
      // Hard requirement: depth capture support
      if (filter.requiresDepthCapture === true && !supportsDepthCapture(d)) return false
      return true
    })
    .reduce<CameraDevice | undefined>((prev, curr) => {
      if (prev == null) return curr

      let prevPoints = 0
      let currPoints = 0

      const physicalDevicesFilter = (filter.physicalDevices ?? [
        'wide-angle',
      ]) as string[]
      // user did pass a physical device filter, two possible scenarios:
      // 1. user wants all cameras ([ultra-wide, wide, tele]) to zoom. prefer those devices that have all 3 cameras.
      // 2. user wants only one ([wide]) for faster performance. prefer those devices that only have one camera, if they have more, we rank them lower.
      for (const physicalCamera of prev.physicalDevices) {
        if (physicalDevicesFilter.includes(physicalCamera.type)) prevPoints += 1
        else prevPoints -= 1
      }
      for (const physicalCamera of curr.physicalDevices) {
        if (physicalDevicesFilter.includes(physicalCamera.type)) currPoints += 1
        else currPoints -= 1
      }

      if (currPoints > prevPoints) return curr
      else return prev
    }, undefined)
}
