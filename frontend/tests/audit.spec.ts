import { test, expect } from '@playwright/test';

test.describe('EdgeSecOps Full Audit', () => {
  // Configurar estado de autenticación para no tener que loguearnos en cada test
  test.use({ storageState: { cookies: [], origins: [{ origin: 'http://192.168.10.121', localStorage: [{ name: 'edge_auth_token', value: 'fake_test_token' }] }] } });

  test.beforeEach(async ({ page }) => {
    // Interceptar llamadas a la API para simular respuestas exitosas y evitar depender del estado real del ESP32 durante la auditoría visual
    await page.route('/api/system/info', async route => {
      await route.fulfill({ json: { chip_model: 'ESP32-S3', chip_cores: 2, cpu_freq_mhz: 240, sdk_version: 'v4.4' } });
    });
    await page.route('/api/system/storage', async route => {
      await route.fulfill({ json: { fs_total: 1000000, fs_used: 500000, nvs_total: 10000, nvs_used: 5000 } });
    });
    await page.route('/api/config/network', async route => {
      await route.fulfill({ json: { ssid: 'TestNet', dhcp: true, mdns: 'edgenode', ntp: 'pool.ntp.org', tz: 'UTC' } });
    });
    await page.route('/api/config/sensors', async route => {
      await route.fulfill({ json: { dht_pin: 4, dht_type: 22, adc_pin: 5, poll: 5000, t_off: -0.5 } });
    });
    await page.route('/api/config/security', async route => {
      await route.fulfill({ json: { jwt_exp: '15', al_en: false, al_ips: '' } });
    });
    await page.route('/api/users', async route => {
      await route.fulfill({ json: { users: [{ username: 'admin', role: 'admin' }, { username: 'testop', role: 'operator' }] } });
    });
    await page.route('/api/keys', async route => {
      await route.fulfill({ json: { keys: [{ label: 'Test Key' }] } });
    });
    
    // Inyectar token real o simulado en sessionStorage antes de navegar
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('edge_auth_token', 'MOCK_TOKEN_FOR_AUDIT');
    });
  });

  test('Auditoría de Navegación y Pestañas Principales', async ({ page }) => {
    await page.goto('/');

    // Verificar que estamos en el Dashboard Principal
    await expect(page.locator('h1').filter({ hasText: 'Monitor Operacional' }).first()).toBeVisible();

    // Navegar a Configuraciones (Desktop Sidebar)
    await page.click('text=Configuraciones');
    await expect(page.locator('h1').filter({ hasText: 'Administración de Nodo' }).first()).toBeVisible();

    // Verificar existencia de las 3 pestañas principales
    const tabs = ['Infraestructura', 'Accesos', 'Mantenimiento'];
    for (const tab of tabs) {
      const tabButton = page.locator('button', { hasText: tab });
      await expect(tabButton).toBeVisible();
    }
  });

  test('Auditoría de Grupo: Infraestructura', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Configuraciones');
    await page.click('button:has-text("Infraestructura")');

    // Verificar formularios modulares
    await expect(page.locator('h3:has-text("Red y Conectividad")')).toBeVisible();
    await expect(page.locator('h3:has-text("Parámetros de Sensores")')).toBeVisible();

    // Interactuar con campos de red
    await expect(page.locator('input[type="checkbox"]').first()).toBeVisible(); // DHCP toggle
  });

  test('Auditoría de Grupo: Accesos', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Configuraciones');
    await page.click('button:has-text("Accesos")');

    // Verificar Formularios de Seguridad y Usuarios
    await expect(page.locator('h3:has-text("Políticas de Seguridad Global")')).toBeVisible();
    await expect(page.locator('h3:has-text("Gestión IAM")')).toBeVisible();
    await expect(page.locator('h3:has-text("Claves API (M2M)")')).toBeVisible();

    // Verificar renderizado de la tabla de usuarios (Mocks)
    await expect(page.locator('td:has-text("testop")')).toBeVisible();
    await expect(page.locator('td:has-text("Test Key")')).toBeVisible();
  });

  test('Auditoría de Grupo: Mantenimiento', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Configuraciones');
    await page.click('button:has-text("Mantenimiento")');

    // Verificar Componentes del Sistema
    await expect(page.locator('h3:has-text("Información del Sistema")')).toBeVisible();
    await expect(page.locator('h3:has-text("Almacenamiento y Mantenimiento")')).toBeVisible();
    await expect(page.locator('h3:has-text("Actualización de Firmware (OTA)")')).toBeVisible();

    // Verificar datos simulados
    await expect(page.locator('p:has-text("ESP32-S3")')).toBeVisible();
    
    // Zonas de Peligro
    await expect(page.locator('button:has-text("Factory Reset")')).toBeVisible();
    await expect(page.locator('button:has-text("Purgar Logs")')).toBeVisible();
  });
  
  test('Auditoría de Responsividad (Mobile View)', async ({ page }) => {
    // Simular un dispositivo móvil (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Verificar que el Sidebar de Desktop esté oculto
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeHidden();

    // Verificar que el Bottom Navigation Bar sea visible
    const bottomNav = page.locator('nav.md\\:hidden');
    await expect(bottomNav).toBeVisible();

    // Verificar botones del bottom nav
    await expect(bottomNav.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(bottomNav.locator('button:has-text("Config")')).toBeVisible();
    await expect(bottomNav.locator('button:has-text("Salir")')).toBeVisible();

    // Navegar usando Bottom Nav
    await bottomNav.locator('button:has-text("Config")').click();
    await expect(page.locator('h1').filter({ hasText: 'EdgeSecOps' }).first()).toBeVisible();
  });
});
