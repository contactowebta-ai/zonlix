import { parsePhoneNumberWithError, ParseError } from 'libphonenumber-js/max';

export type PhoneType = 'MOBILE' | 'LANDLINE' | 'UNVERIFIED' | 'UNKNOWN';

export function validatePhoneType(phone: string | null | undefined, defaultCountry: any = 'MX'): PhoneType {
  if (!phone) return 'UNKNOWN';
  
  try {
    const phoneNumber = parsePhoneNumberWithError(phone, defaultCountry);
    const type = phoneNumber.getType();
    
    if (type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE') {
      return 'MOBILE';
    } else if (type === 'FIXED_LINE' || type === 'TOLL_FREE' || type === 'UAN') {
      return 'LANDLINE';
    }
    
    return 'UNVERIFIED';
  } catch (error) {
    if (error instanceof ParseError) {
      // Intento manual con fallback a México si falló por falta de código
      try {
        if (!phone.startsWith('+')) {
          const fallbackNumber = parsePhoneNumberWithError(`+52${phone.replace(/\D/g, '')}`);
          const type = fallbackNumber.getType();
          if (type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE') return 'MOBILE';
          if (type === 'FIXED_LINE') return 'LANDLINE';
        }
      } catch (e) {}
    }
    return 'UNKNOWN';
  }
}
