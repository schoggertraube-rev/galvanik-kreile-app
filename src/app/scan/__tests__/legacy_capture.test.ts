import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('B0-CAPTURE-CANONICALIZE-BUILD-01 Contract Tests', () => {
  it('B0-A1 /scan nutzt nicht mehr createOrderFromScan produktiv', () => {
    const pagePath = path.join(__dirname, '../../scan/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf8');
    expect(content).not.toContain('createOrderFromScan');
  });

  it('B0-A2 CameraCapture ruft processImage nicht vor gesichertem Original', () => {
    const componentPath = path.join(__dirname, '../../../components/intake/CameraCapture.tsx');
    const content = fs.readFileSync(componentPath, 'utf8');
    expect(content).not.toContain('processImage');
    expect(content).not.toContain('toDataURL');
  });

  it('B0-A3 Kein hartkodierter Tenant in uploadOrderPhotoRecord', () => {
    const actionsPath = path.join(__dirname, '../../../features/orders/orderPhoto.actions.ts');
    const content = fs.readFileSync(actionsPath, 'utf8');
    expect(content).not.toContain("tenantId: 'galvanik-kreile'");
  });

  it('B0-A4 Kein Public-URL-Vertrag in OrderOverlay für neue Uploads', () => {
    const componentPath = path.join(__dirname, '../../../components/orders/OrderOverlay.tsx');
    const content = fs.readFileSync(componentPath, 'utf8');
    expect(content).not.toContain('getPublicUrl');
    expect(content).not.toContain('Date.now()');
  });
});
