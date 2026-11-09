import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';

export async function callPhoneNumber(phone: string): Promise<void> {
  const normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.length < 7) throw new Error('该学生没有可拨打的手机号');
  const url = `tel:${normalized}`;
  if (Capacitor.isNativePlatform()) {
    await AppLauncher.openUrl({ url });
  } else {
    window.location.href = url;
  }
}
