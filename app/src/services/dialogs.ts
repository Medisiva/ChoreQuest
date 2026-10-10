import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';
import { create } from 'zustand';
export const useDialogStore = create<{ dialog: { title: string; message?: string; buttons: AlertButton[] } | null; close: () => void }>((set) => ({ dialog: null, close: () => set({ dialog: null }) }));
const Alert = Platform.OS === 'web' ? {
 alert: (title: string, message?: string, buttons?: AlertButton[]) => useDialogStore.setState({ dialog: { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] } }),
} : NativeAlert;
export default Alert;
