package com.yazicim

import android.content.Context
import android.print.PrintAttributes
import android.print.PrinterCapabilitiesInfo
import android.print.PrinterId
import android.print.PrinterInfo
import android.os.ParcelFileDescriptor
import android.printservice.PrintJob
import android.printservice.PrintService
import android.printservice.PrinterDiscoverySession
import android.util.Log
import java.io.OutputStream
import java.net.Socket
import java.net.InetSocketAddress
import java.util.*
import kotlin.concurrent.thread

class YazicimPrintService : PrintService() {

    override fun onCreatePrinterDiscoverySession(): PrinterDiscoverySession {
        return object : PrinterDiscoverySession() {
            override fun onStartPrinterDiscovery(priorityList: List<PrinterId>) {
                Log.d("Yazicim", "onStartPrinterDiscovery")
                val printerId = generatePrinterId("windows_printer")
                val printerInfo = PrinterInfo.Builder(
                    printerId,
                    "Windows Yazıcı",
                    PrinterInfo.STATUS_IDLE
                )
                    .setCapabilities(
                        PrinterCapabilitiesInfo.Builder(printerId)
                            .addMediaSize(PrintAttributes.MediaSize.ISO_A4, true)
                            .addResolution(PrintAttributes.Resolution("id", "label", 300, 300), true)
                            .setColorModes(PrintAttributes.COLOR_MODE_MONOCHROME, PrintAttributes.COLOR_MODE_MONOCHROME)
                            .build()
                    )
                    .build()
                addPrinters(listOf(printerInfo))
            }

            override fun onStopPrinterDiscovery() {}
            override fun onValidatePrinters(printerIds: List<PrinterId>) {}
            override fun onStartPrinterStateTracking(printerId: PrinterId) {}
            override fun onStopPrinterStateTracking(printerId: PrinterId) {}
            override fun onDestroy() {}
        }
    }

    override fun onPrintJobQueued(printJob: PrintJob) {
        Log.d("YazicimPrintService", "Print job queued: ${printJob.info.label}")

        // getDocument must be called on the main thread!
        val document = printJob.document

        thread {
            try {
                // Read from document's input stream in background
                val inputStream = ParcelFileDescriptor.AutoCloseInputStream(document.data)
                val pdfData = inputStream.readBytes()
                inputStream.close()

                Log.d("YazicimPrintService", "PDF data length: ${pdfData.size}")
                
                // Get printer settings from preferences
                val sharedPref = getSharedPreferences("react-native-default-preference", MODE_PRIVATE)
                val ip = sharedPref.getString("printer_ip", "192.168.1.106") ?: "192.168.1.106"
                val port = sharedPref.getString("printer_port", "9100")?.toInt() ?: 9100

                val socket = Socket()
                socket.connect(InetSocketAddress(ip, port), 5000)
                val outputStream = socket.getOutputStream()

                // Header: [Name Len] + [Name] + [Data]
                val fileName = "PrintService_${System.currentTimeMillis()}.pdf"
                val nameBytes = fileName.toByteArray()
                outputStream.write(nameBytes.size)
                outputStream.write(nameBytes)
                outputStream.write(pdfData)
                outputStream.flush()
                socket.close()

                printJob.complete()
                Log.d("YazicimPrintService", "Print job sent successfully")
            } catch (e: Exception) {
                Log.e("YazicimPrintService", "Error sending print job", e)
                printJob.fail("Bağlantı Hatası: ${e.message}")
            }
        }
    }

    override fun onRequestCancelPrintJob(printJob: PrintJob) {
        printJob.cancel()
    }
}
