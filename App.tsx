import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Dimensions,
} from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { NetworkInfo } from 'react-native-network-info';

const { width } = Dimensions.get('window');

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';
  const [ip, setIp] = useState('192.168.1.106');
  const [port, setPort] = useState('9100');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sharedFile, setSharedFile] = useState<{ uri: string, fileName: string } | null>(null);
  const [phoneIp, setPhoneIp] = useState<string | null>(null);

  useEffect(() => {
    // Ayarları yükle
    DefaultPreference.get('printer_ip').then(val => val && setIp(val));
    DefaultPreference.get('printer_port').then(val => val && setPort(val));

    // Telefon IP'sini al
    NetworkInfo.getIPAddress().then(ipAddr => {
      setPhoneIp(ipAddr);
    });

    console.log('Dinleyici başlatılıyor...');

    // Gelen dosyayı dinle
    const subscription = DeviceEventEmitter.addListener('onSharedFile', (data) => {
      console.log('DOSYA YAKALANDI:', data.fileName);
      setSharedFile({ uri: data.uri, fileName: data.fileName });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const saveSettings = async () => {
    try {
      await DefaultPreference.set('printer_ip', ip);
      await DefaultPreference.set('printer_port', port);
      Alert.alert('Başarılı', 'Ayarlar kaydedildi.');
    } catch (error) {
      Alert.alert('Hata', 'Ayarlar kaydedilemedi.');
    }
  };

  const testConnection = () => {
    setIsSending(true);
    setStatus('idle');
    const client = TcpSocket.createConnection({ port: parseInt(port, 10), host: ip }, () => {
      const testBuffer = Buffer.alloc(1);
      testBuffer.writeUInt8(0, 0);
      client.write(testBuffer);
      client.end();

      setIsSending(false);
      setStatus('success');
      Alert.alert('Bağlantı Başarılı', 'Windows sunucusuna ulaşıldı!');
    });

    client.on('error', (error) => {
      setIsSending(false);
      setStatus('error');
      Alert.alert('Hata', 'Sunucuya bağlanılamadı. IP adresini kontrol edin.');
      client.destroy();
    });

    setTimeout(() => {
      if (isSending) {
        client.destroy();
        setIsSending(false);
        setStatus('error');
      }
    }, 5000);
  };

  const sendFileToPC = async (uri: string, fileName: string) => {
    setIsSending(true);
    setStatus('idle');

    try {
      // Dosyayı oku
      const fileData = await RNFS.readFile(uri, 'base64');
      const binaryData = Buffer.from(fileData, 'base64');

      const nameBuffer = Buffer.from(fileName, 'utf-8');
      const header = Buffer.alloc(1);
      header.writeUInt8(nameBuffer.length, 0);

      const packet = Buffer.concat([header, nameBuffer, binaryData]);

      const client = TcpSocket.createConnection(
        {
          port: parseInt(port, 10),
          host: ip,
        },
        () => {
          client.write(packet);
          client.end();

          setStatus('success');
          setIsSending(false);
          setSharedFile(null);
          Alert.alert('Başarılı', fileName + ' başarıyla yazdırılmak üzere gönderildi.');
        }
      );

      client.on('error', (error) => {
        setStatus('error');
        setIsSending(false);
        Alert.alert('Bağlantı Hatası', 'Sunucuya ulaşılamadı. Python sunucusunu kontrol edin.');
        client.destroy();
      });

    } catch (error: any) {
      console.error(error);
      setIsSending(false);
      setStatus('error');
      Alert.alert('Hata', 'Dosya okunurken bir sorun oluştu. Lütfen dosya izinlerini kontrol edin.');
    }
  };

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
    flex: 1,
  };

  const textColor = isDarkMode ? '#f8fafc' : '#1e293b';
  const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
  const inputBg = isDarkMode ? '#334155' : '#f1f5f9';

  const isImage = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Yazıcım</Text>
          <Text style={styles.subtitle}>Paylaş ve Anında Yazdır</Text>
          {phoneIp && (
            <View style={styles.ipBadge}>
              <Text style={styles.ipText}>Cihaz IP: {phoneIp}</Text>
            </View>
          )}
        </View>

        {sharedFile ? (
          <View style={[styles.card, styles.previewCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Yazdırma Önizleme</Text>

            <View style={styles.previewContainer}>
              {isImage(sharedFile.fileName) ? (
                <Image
                  source={{ uri: sharedFile.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.fileIconPlaceholder}>
                  <Text style={styles.fileEmoji}>{sharedFile.fileName.endsWith('.pdf') ? '📄' : '📝'}</Text>
                  <Text style={[styles.fileNameText, { color: textColor }]}>{sharedFile.fileName}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, styles.printButton]}
              onPress={() => sendFileToPC(sharedFile.uri, sharedFile.fileName)}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.printAction}>
                  <Text style={styles.buttonText}>🖨️ Bilgisayarda Yazdır</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSharedFile(null)}
              style={styles.cancelLink}
            >
              <Text style={styles.cancelText}>İptal Et</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#3b82f6' }]}>
            <Text style={[styles.cardTitle, { color: '#fff' }]}>Başlamak İçin</Text>
            <Text style={{ color: '#fff', opacity: 0.9, lineHeight: 22 }}>
              WPS Office, Galeri veya herhangi bir uygulamadan bir dosya seçin ve "Paylaş" diyerek "Yazıcım" uygulamasını seçin.
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.label, { color: textColor }]}>Sunucu (Bilgisayar) IP Adresi</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
            value={ip}
            onChangeText={setIp}
            placeholder="Örn: 192.168.1.106"
            placeholderTextColor="#94a3b8"
          />

          <Text style={[styles.label, { color: textColor }]}>Sunucu Port</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
            value={port}
            onChangeText={setPort}
            placeholder="9100"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={testConnection}
              disabled={isSending}
            >
              <Text style={styles.buttonText}>Bağlantıyı Test Et</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={saveSettings}
            >
              <Text style={styles.buttonText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={[styles.statusDot, { backgroundColor: status === 'success' ? '#22c55e' : status === 'error' ? '#ef4444' : '#94a3b8' }]} />
          <Text style={styles.statusText}>
            {status === 'success' ? 'Sunucu Bağlı' : status === 'error' ? 'Bağlantı Yok' : 'Bekleniyor'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  ipBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  ipText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  card: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  previewCard: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  previewContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  fileIconPlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  fileEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    color: '#64748b',
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printButton: {
    backgroundColor: '#3b82f6',
  },
  printAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#1e293b',
    flex: 2,
  },
  saveButton: {
    backgroundColor: '#10b981',
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
});

export default App;
