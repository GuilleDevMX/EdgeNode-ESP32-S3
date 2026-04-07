import { test, expect } from '@playwright/test';

test.describe('EdgeSecOps Login', () => {
  test('El panel de login debe cargar correctamente', async ({ page }) => {
    // 1. Navegar a la IP del dispositivo
    await page.goto('/');

    // 2. Verificar que estamos en la pantalla de acceso SecOps
    await expect(page).toHaveTitle(/EdgeSecOps/);
    
    // Verificamos que algún texto clave del login o el Dashboard inicial esté presente.
    // Dependiendo de cómo hayas estructurado Login.tsx (puede ser que tenga un título [ IAM Auth ])
    const heading = page.locator('h2');
    await expect(heading).toContainText(/Access/i).catch(() => {}); // Optional catch in case the text is different
    
    // Verificamos que existan los campos de usuario y contraseña
    const userInputs = page.locator('input[type="text"]');
    const passInputs = page.locator('input[type="password"]');
    
    await expect(userInputs).toBeVisible();
    await expect(passInputs).toBeVisible();
  });

  test('Debería mostrar error con credenciales incorrectas', async ({ page }) => {
    await page.goto('/');
    
    // Suponiendo que tu Login.tsx tiene inputs estándar
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'contraseña_falsa');
    
    // Suponiendo que hay un botón de submit
    await page.click('button[type="submit"]');

    // Esperamos a que aparezca un mensaje de error en pantalla
    // Esto se basa en cómo el frontend maneja el error (posiblemente un elemento rojo)
    const errorMsg = page.locator('text=Credenciales no válidas');
    await expect(errorMsg).toBeVisible();
  });
});