import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// WordPress supplies React through its registered wp-element dependency.
// Keep one application source while avoiding a second renderer in the plugin package.
function wordpressElements() {
  const id = '\0vwc-wp-element';
  const exports = ['Children', 'cloneElement', 'Component', 'createContext', 'createElement', 'createRef', 'forwardRef', 'Fragment', 'isValidElement', 'lazy', 'memo', 'PureComponent', 'startTransition', 'StrictMode', 'Suspense', 'useCallback', 'useContext', 'useDebugValue', 'useDeferredValue', 'useEffect', 'useId', 'useImperativeHandle', 'useInsertionEffect', 'useLayoutEffect', 'useMemo', 'useReducer', 'useRef', 'useState', 'useSyncExternalStore', 'useTransition'];
  return {
    name: 'vwc-wordpress-elements',
    enforce: 'pre',
    resolveId(source) { if (['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'].includes(source)) return id + ':' + source; },
    load(source) {
      if (source === id + ':react') return `const element=window.wp.element; export default element; ${exports.map(name => `export const ${name}=element.${name};`).join('\n')}`;
      if (source === id + ':react-dom/client') return 'export const createRoot=window.wp.element.createRoot; export const hydrateRoot=window.wp.element.hydrateRoot;';
      if (source === id + ':react/jsx-runtime' || source === id + ':react/jsx-dev-runtime') return `const element=window.wp.element; export const Fragment=element.Fragment; export function jsx(type,props,key){return element.createElement(type,key===undefined?props:{...props,key});} export const jsxs=jsx; export const jsxDEV=jsx;`;
    },
  };
}
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: false,
  plugins: [...(mode === 'wordpress' ? [wordpressElements()] : []), react(), tailwindcss()],
  build: {
    outDir: mode === 'wordpress' ? 'dist-wordpress' : 'dist',
    rollupOptions: { output: { entryFileNames: 'assets/conference.js', assetFileNames: 'assets/conference.[ext]' } },
    sourcemap: false,
  },
}));
