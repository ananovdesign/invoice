import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'; // Import path module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { // Add this block
    alias: {
      // This alias tells Vite that when it sees 'Firebase', it should look in 'src/Firebase.js'
      'Firebase': path.resolve(__dirname, 'src/Firebase.js'),
    },
  },
  // ... other existing configurations ...
})
