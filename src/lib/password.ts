export function generateRandomPassword(length = 14) {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%^&*_-+=?';
  const all = `${uppercase}${lowercase}${digits}${specials}`;

  const required = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  while (required.length < length) {
    required.push(all[Math.floor(Math.random() * all.length)]);
  }

  return required
    .sort(() => Math.random() - 0.5)
    .join('');
}

export function getPasswordPolicyHint() {
  return 'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
}
