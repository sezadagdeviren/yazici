# -*- coding: utf-8 -*-
import socket
import os
import time

PRINTER_NAME = "Windows Varsayilan Yazici"
PORT = 9100
SAVE_DIR = "gelen_dosyalar"

# Klasor yoksa olustur
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def start_server():
    print("\n" + "="*40)
    print("      YAZICIM - WINDOWS SUNUCU")
    print("="*40)
    print("IP Adresiniz: {0}".format(get_ip()))
    print("Port        : {0}".format(PORT))
    print("Dizin       : {0}".format(os.path.abspath(SAVE_DIR)))
    print("Durum       : BAGLANTI BEKLENIYOR...")
    print("="*40)

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('0.0.0.0', PORT))
        s.listen(5)
        
        while True:
            conn, addr = s.accept()
            with conn:
                print("\n[BILGI] Uygulama baglandi: {0}".format(addr))
                
                # 1. Dosya Ismi Uzunlugu (1 byte)
                len_byte = conn.recv(1)
                if not len_byte: continue
                name_len = ord(len_byte) if isinstance(len_byte, str) else len_byte[0]
                
                if name_len == 0:
                    print("[TEST] Baglanti testi basarili.")
                    continue

                # 2. Dosya Ismi
                file_name_raw = conn.recv(name_len).decode('utf-8', errors='replace')
                # Dosya ismini temizle
                file_name = os.path.basename(file_name_raw)
                save_path = os.path.join(SAVE_DIR, file_name)
                
                print("[AKTARIM] Gelen dosya: {0}".format(file_name))
                print("[AKTARIM] Veri indiriliyor...")
                
                # 3. Dosya Verisi
                raw_data = b""
                while True:
                    chunk = conn.recv(262144) 
                    if not chunk: break
                    raw_data += chunk
                
                if len(raw_data) > 0:
                    print("[BASARILI] {0} byte alindi.".format(len(raw_data)))
                    
                    # Dosyayi kaydet
                    with open(save_path, "wb") as f:
                        f.write(raw_data)
                    print("[SISTEM] Dosya kaydedildi: {0}".format(save_path))
                    
                    time.sleep(0.5)
                    print("[SISTEM] Yazdirma tetikleniyor...")
                    try:
                        os.startfile(os.path.abspath(save_path), "print")
                        print("[TAMAM] Yazdirma komutu Windows'a iletildi.")
                    except Exception as pe:
                        print("[HATA] Yazdirma baslatilamadi: {0}".format(str(pe)))
                else:
                    print("[HATA] Veri alinamadi.")
                    
    except Exception as e:
        print("[KRITIK HATA] {0}".format(str(e)))

if __name__ == "__main__":
    start_server()