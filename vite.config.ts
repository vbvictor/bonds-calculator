import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base обязан совпадать с именем репозитория, слэши с обеих сторон.
// Иначе GitHub Pages отдаёт белый экран и 404 по ассетам.
export default defineConfig({
  base: '/bonds-calculator/',
  plugins: [react()],
  test: {
    // Модель считается в node, компонентам нужен DOM — окружение задаётся
    // докблоком в самом файле теста.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    css: false,
  },
})
