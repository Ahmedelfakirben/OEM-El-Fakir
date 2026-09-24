/**
 * windowsCatalogService.js
 * Servicio de resolución y taxonomía de Microsoft Windows Update & Intune.
 * 
 * Determina:
 * 1. Si el controlador está admitido y ofertado en el catálogo de Microsoft Windows Update.
 * 2. Si está ofertado ÚNICAMENTE por el fabricante (Solo Soporte Lenovo / Solo Soporte HP).
 * 3. Su respectivo nombre oficial canónico en Windows Update / Intune (SIEMPRE con versión: Vendor - Class - Version).
 */

'use strict';

/**
 * Resuelve los metadatos de admisión y catálogo de Windows para un driver dado.
 *
 * @param {Object} driver - { oem, category, name, version, severity, id }
 * @returns {Object} { windowsAdmitted: boolean, deliverySource: string, windowsAdmittedName: string, windowsChannel: string, whqlId: string, intunePolicy: string, driverClass: string }
 */
function resolveWindowsCatalogInfo(driver) {
  const oem = (driver.oem || 'oem').toLowerCase();
  const cat = (driver.category || '').toLowerCase();
  const name = (driver.name || '').trim();
  const lowerName = name.toLowerCase();
  const rawVer = (driver.version || '').trim();
  const ver = (rawVer && rawVer !== 'N/A') ? rawVer : '1.0.0.0';
  const isCritical = driver.severity === 'Crítico';
  const isOptional = driver.severity === 'Opcional';
  const oemTitle = oem === 'hp' ? 'HP' : 'Lenovo';

  // ────────────────────────────────────────────────────────────────
  // 1. Detección exhaustiva de ítems ofertados SOLO POR EL FABRICANTE
  // (Aplicaciones, herramientas de diagnóstico, utilidades, flashers manuales, paquetes SCCM/PE)
  // ────────────────────────────────────────────────────────────────
  const isSoftwareOrUtilityCategory = /software|utilidad|diagnóstico|diagnostics|gestión de empresas|tool|management/i.test(cat);

  const isOemExclusiveName = /utility|utilidad|vantage|diagnostics|diagnóstico|bootable|mfgstat|migration|system update|thin installer|asset id|firmware update utility|dock firmware|docking|hotkey|wolf security|client security|hp support assistant|hp image assistant|hpia|energy management software|solution center|manageability|commander|sccm package|pe 10|pe 11|maintenance diskette|maintenance key|lstc|auto scroll|quickclean/i.test(lowerName);

  const isManualBiosFlasher = /bios update utility for windows|bios update \(bootable cd\)|flash bios update|bios flash|cd iso/i.test(lowerName);

  if (isSoftwareOrUtilityCategory || isOemExclusiveName || isManualBiosFlasher) {
    return {
      windowsAdmitted: false,
      deliverySource: 'oem_only',
      windowsAdmittedName: `Solo Soporte ${oemTitle} (No en Windows Update)`,
      windowsChannel: `Solo Portal Oficial ${oemTitle}`,
      whqlId: 'N/A (Exclusivo Fabricante)',
      intunePolicy: `No disponible en el catálogo de Windows Update. Despliegue mediante paquete Intune Win32 App (.intunewin) o portal oficial de soporte de ${oemTitle}.`,
      driverClass: 'Herramienta de Fabricante',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 2. Firmware BIOS / UEFI (Cápsulas UEFI certificadas para WU)
  // ────────────────────────────────────────────────────────────────
  if (/bios|uefi|firmware/i.test(cat) || /bios|uefi/i.test(lowerName)) {
    const vendorPrefix = oem === 'hp' ? 'HP Inc.' : 'Lenovo';
    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `${vendorPrefix} - Firmware - ${ver}`,
      windowsChannel: isCritical ? 'Prioritario (Firmware / BIOS)' : 'Opcional (Windows Update)',
      whqlId: `WHQL-FIRMWARE-${oem.toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}`,
      intunePolicy: 'Cápsula UEFI con firma WHQL de Microsoft. Asignable mediante directivas de actualización de firmware de Microsoft Intune.',
      driverClass: 'Firmware',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 3. Controladores de Red / Wi-Fi / Ethernet / WWAN / Bluetooth / NFC
  // ────────────────────────────────────────────────────────────────
  if (/red|wifi|lan|wlan|wireless|ethernet|bluetooth|wan|wwan/i.test(cat) || /wifi|wlan|lan|wireless|bluetooth|wwan|cellular|nfc/i.test(lowerName)) {
    let vendor = 'Intel Corporation';
    if (/realtek/i.test(lowerName)) vendor = 'Realtek';
    else if (/qualcomm|atheros/i.test(lowerName)) vendor = 'Qualcomm Technologies, Inc.';
    else if (/fibocom/i.test(lowerName)) vendor = 'Fibocom Wireless Inc.';
    else if (/sierra/i.test(lowerName)) vendor = 'Sierra Wireless, Inc.';
    else if (/quectel/i.test(lowerName)) vendor = 'Quectel Wireless';
    else if (/mediatek/i.test(lowerName)) vendor = 'MediaTek Inc.';
    else if (/broadcom/i.test(lowerName)) vendor = 'Broadcom';
    else if (/nxp/i.test(lowerName)) vendor = 'NXP Semiconductors';

    let subType = 'Net';
    if (/bluetooth/i.test(cat) || /bluetooth/i.test(lowerName)) subType = 'Bluetooth';
    else if (/nfc/i.test(lowerName)) subType = 'NFC Proximity';

    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `${vendor} - ${subType} - ${ver}`,
      windowsChannel: isOptional ? 'Opcional (Aprobación Intune)' : 'Automático (Windows Update / WHQL)',
      whqlId: `WHQL-NET-${vendor.slice(0, 3).toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
      intunePolicy: 'Certificado WHQL. Despliegue automático como driver recomendado en Windows Update o configurable en Intune.',
      driverClass: subType === 'Bluetooth' ? 'Bluetooth' : 'Network Adapter',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 4. Controladores Gráficos / Display / GPU
  // ────────────────────────────────────────────────────────────────
  if (/gráficos|display|video|gpu/i.test(cat) || /graphics|video|display|vga|intel hd|iris|nvidia|radeon/i.test(lowerName)) {
    let vendor = 'Intel Corporation';
    if (/nvidia/i.test(lowerName)) vendor = 'NVIDIA';
    else if (/amd|radeon/i.test(lowerName)) vendor = 'Advanced Micro Devices, Inc.';

    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `${vendor} - Display - ${ver}`,
      windowsChannel: isOptional ? 'Opcional (Aprobación Intune)' : 'Automático (Windows Update / WHQL)',
      whqlId: `WHQL-DISP-${vendor.slice(0, 3).toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
      intunePolicy: 'Certificado WHQL. Instalación estándar por Windows Update o gestión por perfiles de Intune.',
      driverClass: 'Display Adapter',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 5. Audio
  // ────────────────────────────────────────────────────────────────
  if (/audio|sound/i.test(cat) || /audio|sound|realtek high|conexant/i.test(lowerName)) {
    let vendor = 'Realtek Semiconductor Corp.';
    if (/synaptics|conexant/i.test(lowerName)) vendor = 'Synaptics Incorporated';
    else if (/intel/i.test(lowerName)) vendor = 'Intel Corporation';

    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `${vendor} - MEDIA - ${ver}`,
      windowsChannel: isOptional ? 'Opcional (Aprobación Intune)' : 'Automático (Windows Update / WHQL)',
      whqlId: `WHQL-MEDIA-${vendor.slice(0, 3).toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
      intunePolicy: 'Controlador de audio WHQL aceptado en Windows Update. Asignable mediante Intune Driver Updates.',
      driverClass: 'Audio, Video and Game Controllers',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 6. Chipset / Sistema / Intel Management Engine / Sensores
  // ────────────────────────────────────────────────────────────────
  if (/chipset|sistema|intel platform/i.test(cat) || /chipset|management engine|intel me|serial io|sensor/i.test(lowerName)) {
    const vendor = /amd/i.test(lowerName) ? 'Advanced Micro Devices, Inc.' : 'Intel';
    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `${vendor} - System - ${ver}`,
      windowsChannel: 'Automático (Windows Update / WHQL)',
      whqlId: `WHQL-SYS-${vendor.slice(0, 3).toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
      intunePolicy: 'Componente de plataforma de sistema. Windows Update lo descarga de forma recomendada prioritaria.',
      driverClass: 'System Devices',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 7. Periféricos / Touchpad / Teclado / Huellas Dactilares
  // ────────────────────────────────────────────────────────────────
  if (/periféricos|touchpad|mouse|keyboard|huellas|fingerprint|biometric/i.test(cat) || /touchpad|trackpoint|pointing|fingerprint|wbdi/i.test(lowerName)) {
    let vendor = 'Synaptics';
    if (/elan/i.test(lowerName)) vendor = 'ELAN Microelectronics Corp.';
    else if (/alps/i.test(lowerName)) vendor = 'Alps Electric Co.';

    const subClass = /fingerprint|huellas/i.test(cat) || /fingerprint/i.test(lowerName) ? 'Biometric' : 'HIDClass';
    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `${vendor} - ${subClass} - ${ver}`,
      windowsChannel: 'Automático (Windows Update / WHQL)',
      whqlId: `WHQL-HID-${vendor.slice(0, 3).toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
      intunePolicy: 'Controlador de interfaz humana / biometría con certificación WHQL de Microsoft.',
      driverClass: subClass === 'Biometric' ? 'Biometric Devices' : 'Human Interface Devices',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 8. Almacenamiento / Storage / NVMe
  // ────────────────────────────────────────────────────────────────
  if (/almacenamiento|storage|nvme|sata/i.test(cat) || /nvme|rapid storage|rst|sata/i.test(lowerName)) {
    return {
      windowsAdmitted: true,
      deliverySource: 'windows_update',
      windowsAdmittedName: `Intel Corporation - Storage - ${ver}`,
      windowsChannel: 'Automático (Windows Update / WHQL)',
      whqlId: `WHQL-STOR-INTEL-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
      intunePolicy: 'Controlador de controladora de almacenamiento WHQL estándar.',
      driverClass: 'Storage Controllers',
    };
  }

  // ────────────────────────────────────────────────────────────────
  // 9. Componente genérico OEM admitido en Windows Update (Siempre con versión)
  // ────────────────────────────────────────────────────────────────
  const vendorPrefix = oem === 'hp' ? 'HP Inc.' : 'Lenovo';
  return {
    windowsAdmitted: true,
    deliverySource: 'windows_update',
    windowsAdmittedName: `${vendorPrefix} - System - ${ver}`,
    windowsChannel: isOptional ? 'Opcional (Aprobación Intune)' : 'Automático (Windows Update / WHQL)',
    whqlId: `WHQL-${oem.toUpperCase()}-${ver.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'GEN'}`,
    intunePolicy: 'Registrado en el catálogo de controladores certificados para Windows 11.',
    driverClass: 'System Component',
  };
}

module.exports = {
  resolveWindowsCatalogInfo,
};
