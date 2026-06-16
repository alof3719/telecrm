// Country code → IANA timezone mapping
// Ordered longest-prefix-first for correct matching
const CODE_TIMEZONE_MAP = [
  // 4-digit codes
  ['+1242', 'America/Nassau'],
  ['+1246', 'America/Barbados'],
  ['+1264', 'America/Anguilla'],
  ['+1268', 'America/Antigua'],
  ['+1284', 'America/Tortola'],
  ['+1340', 'America/St_Thomas'],
  ['+1345', 'America/Cayman'],
  ['+1441', 'America/Bermuda'],
  ['+1473', 'America/Grenada'],
  ['+1649', 'America/Grand_Turk'],
  ['+1664', 'America/Montserrat'],
  ['+1670', 'Pacific/Saipan'],
  ['+1671', 'Pacific/Guam'],
  ['+1684', 'Pacific/Pago_Pago'],
  ['+1758', 'America/St_Lucia'],
  ['+1767', 'America/Dominica'],
  ['+1784', 'America/St_Vincent'],
  ['+1809', 'America/Santo_Domingo'],
  ['+1868', 'America/Port_of_Spain'],
  ['+1869', 'America/St_Kitts'],
  ['+1876', 'America/Jamaica'],
  // 3-digit codes
  ['+852', 'Asia/Hong_Kong'],
  ['+853', 'Asia/Macau'],
  ['+855', 'Asia/Phnom_Penh'],
  ['+856', 'Asia/Vientiane'],
  ['+880', 'Asia/Dhaka'],
  ['+886', 'Asia/Taipei'],
  ['+960', 'Indian/Maldives'],
  ['+961', 'Asia/Beirut'],
  ['+962', 'Asia/Amman'],
  ['+963', 'Asia/Damascus'],
  ['+964', 'Asia/Baghdad'],
  ['+965', 'Asia/Kuwait'],
  ['+966', 'Asia/Riyadh'],
  ['+967', 'Asia/Aden'],
  ['+968', 'Asia/Muscat'],
  ['+971', 'Asia/Dubai'],
  ['+972', 'Asia/Jerusalem'],
  ['+973', 'Asia/Bahrain'],
  ['+974', 'Asia/Qatar'],
  ['+975', 'Asia/Thimphu'],
  ['+976', 'Asia/Ulaanbaatar'],
  ['+977', 'Asia/Kathmandu'],
  ['+992', 'Asia/Dushanbe'],
  ['+993', 'Asia/Ashgabat'],
  ['+994', 'Asia/Baku'],
  ['+995', 'Asia/Tbilisi'],
  ['+996', 'Asia/Bishkek'],
  ['+998', 'Asia/Tashkent'],
  ['+212', 'Africa/Casablanca'],
  ['+213', 'Africa/Algiers'],
  ['+216', 'Africa/Tunis'],
  ['+218', 'Africa/Tripoli'],
  ['+220', 'Africa/Banjul'],
  ['+221', 'Africa/Dakar'],
  ['+222', 'Africa/Nouakchott'],
  ['+223', 'Africa/Bamako'],
  ['+224', 'Africa/Conakry'],
  ['+225', 'Africa/Abidjan'],
  ['+226', 'Africa/Ouagadougou'],
  ['+227', 'Africa/Niamey'],
  ['+228', 'Africa/Lome'],
  ['+229', 'Africa/Porto-Novo'],
  ['+230', 'Indian/Mauritius'],
  ['+231', 'Africa/Monrovia'],
  ['+232', 'Africa/Freetown'],
  ['+233', 'Africa/Accra'],
  ['+234', 'Africa/Lagos'],
  ['+235', 'Africa/Ndjamena'],
  ['+236', 'Africa/Bangui'],
  ['+237', 'Africa/Douala'],
  ['+238', 'Atlantic/Cape_Verde'],
  ['+239', 'Africa/Sao_Tome'],
  ['+240', 'Africa/Malabo'],
  ['+241', 'Africa/Libreville'],
  ['+242', 'Africa/Brazzaville'],
  ['+243', 'Africa/Kinshasa'],
  ['+244', 'Africa/Luanda'],
  ['+245', 'Africa/Bissau'],
  ['+246', 'Indian/Chagos'],
  ['+248', 'Indian/Mahe'],
  ['+249', 'Africa/Khartoum'],
  ['+250', 'Africa/Kigali'],
  ['+251', 'Africa/Addis_Ababa'],
  ['+252', 'Africa/Mogadishu'],
  ['+253', 'Africa/Djibouti'],
  ['+254', 'Africa/Nairobi'],
  ['+255', 'Africa/Dar_es_Salaam'],
  ['+256', 'Africa/Kampala'],
  ['+257', 'Africa/Bujumbura'],
  ['+258', 'Africa/Maputo'],
  ['+260', 'Africa/Lusaka'],
  ['+261', 'Indian/Antananarivo'],
  ['+262', 'Indian/Reunion'],
  ['+263', 'Africa/Harare'],
  ['+264', 'Africa/Windhoek'],
  ['+265', 'Africa/Blantyre'],
  ['+266', 'Africa/Maseru'],
  ['+267', 'Africa/Gaborone'],
  ['+268', 'Africa/Mbabane'],
  ['+269', 'Indian/Comoro'],
  ['+290', 'Atlantic/St_Helena'],
  ['+291', 'Africa/Asmara'],
  ['+297', 'America/Aruba'],
  ['+298', 'Atlantic/Faroe'],
  ['+299', 'America/Godthab'],
  // 2-digit codes
  ['+61', 'Australia/Sydney'],
  ['+62', 'Asia/Jakarta'],
  ['+63', 'Asia/Manila'],
  ['+64', 'Pacific/Auckland'],
  ['+65', 'Asia/Singapore'],
  ['+66', 'Asia/Bangkok'],
  ['+81', 'Asia/Tokyo'],
  ['+82', 'Asia/Seoul'],
  ['+84', 'Asia/Ho_Chi_Minh'],
  ['+86', 'Asia/Shanghai'],
  ['+90', 'Europe/Istanbul'],
  ['+91', 'Asia/Kolkata'],
  ['+92', 'Asia/Karachi'],
  ['+93', 'Asia/Kabul'],
  ['+94', 'Asia/Colombo'],
  ['+95', 'Asia/Rangoon'],
  ['+98', 'Asia/Tehran'],
  ['+20', 'Africa/Cairo'],
  ['+27', 'Africa/Johannesburg'],
  ['+30', 'Europe/Athens'],
  ['+31', 'Europe/Amsterdam'],
  ['+32', 'Europe/Brussels'],
  ['+33', 'Europe/Paris'],
  ['+34', 'Europe/Madrid'],
  ['+36', 'Europe/Budapest'],
  ['+39', 'Europe/Rome'],
  ['+40', 'Europe/Bucharest'],
  ['+41', 'Europe/Zurich'],
  ['+43', 'Europe/Vienna'],
  ['+44', 'Europe/London'],
  ['+45', 'Europe/Copenhagen'],
  ['+46', 'Europe/Stockholm'],
  ['+47', 'Europe/Oslo'],
  ['+48', 'Europe/Warsaw'],
  ['+49', 'Europe/Berlin'],
  ['+51', 'America/Lima'],
  ['+52', 'America/Mexico_City'],
  ['+53', 'America/Havana'],
  ['+54', 'America/Argentina/Buenos_Aires'],
  ['+55', 'America/Sao_Paulo'],
  ['+56', 'America/Santiago'],
  ['+57', 'America/Bogota'],
  ['+58', 'America/Caracas'],
  ['+60', 'Asia/Kuala_Lumpur'],
  ['+7', 'Europe/Moscow'],
  ['+1', 'America/New_York'],
]

/**
 * Given a phone number string (e.g. "+61412345678"), returns the IANA timezone.
 * Returns null if no match found.
 */
export function getTimezoneFromPhone(phone) {
  if (!phone) return null
  const cleaned = phone.replace(/[\s\-().]/g, '')
  for (const [code, tz] of CODE_TIMEZONE_MAP) {
    if (cleaned.startsWith(code)) return tz
  }
  return null
}

/**
 * Returns the client's current local time as a formatted string,
 * or null if timezone cannot be determined.
 */
export function getClientLocalTime(phone) {
  const tz = getTimezoneFromPhone(phone)
  if (!tz) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
    }).format(new Date())
  } catch {
    return null
  }
}

/**
 * Returns the timezone abbreviation and city name for display.
 */
export function getTimezoneLabel(phone) {
  const tz = getTimezoneFromPhone(phone)
  if (!tz) return null
  const city = tz.split('/').pop().replace(/_/g, ' ')
  return city
}
