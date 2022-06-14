/**
 * 如果是 0x00 地址返回 true, 否则返回 flase
 * @param hexNumberString
 */
export default function isZero(hexNumberString: string) {
  return /^0x0*$/.test(hexNumberString)
}
