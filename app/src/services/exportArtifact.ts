import { Platform, Share } from 'react-native';
export async function exportArtifact(data: unknown): Promise<void> {
 const json = JSON.stringify(data, null, 2);
 if (Platform.OS !== 'web') { await Share.share({ title: 'ChoreQuest family data', message: json }); return; }
 const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
 const link = document.createElement('a'); link.href = url; link.download = 'chorequest-family-export.json';
 document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
