// js/utils/validator.js
// Standardized validation logic

const Validator = (() => {
  function isIndianPhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.trim());
  }

  function isEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  function isIndianPincode(pincode) {
    const pincodeRegex = /^\d{6}$/;
    return pincodeRegex.test(pincode.trim());
  }

  function isValidAddress(address) {
    return address && address.trim().length >= 8;
  }

  return {
    isIndianPhone,
    isEmail,
    isIndianPincode,
    isValidAddress
  };
})();
