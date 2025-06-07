import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'
import replace from '@rollup/plugin-replace'
import { terser } from 'rollup-plugin-terser'
import postcss from 'rollup-plugin-postcss'

const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/index.jsx',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    sourcemap: true,
    name: 'jsQuotes'
  },
  plugins: [
    resolve({
      extensions: ['.js', '.jsx'],
      browser: true,
      preferBuiltins: false
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
      preventAssignment: true
    }),
    commonjs({
      include: 'node_modules/**',
      transformMixedEsModules: true
    }),
    babel({
      babelHelpers: 'bundled',
      presets: ['@babel/preset-env', '@babel/preset-react'],
      extensions: ['.js', '.jsx'],
      exclude: 'node_modules/**'
    }),
    postcss({
      extensions: ['.css'],
    }),
    !production && serve({
      open: true,
      contentBase: ['dist', 'public'],
      host: 'localhost',
      port: 3000
    }),
    !production && livereload('dist'),
    production && terser()
  ],
  watch: {
    clearScreen: false,
  },
}
