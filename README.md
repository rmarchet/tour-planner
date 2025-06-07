# React Rollup Template
A minimal boilerplate for building React Single Page Applications bundled with Rollup

## Features
- React 19
- Rollup bundling
- Babel transpilation
- CSS processing with PostCSS
- Development server with live reloading
- Production optimization


## Getting Started

### Prerequisites
- Node.js and npm/yarn installed on your machine

### Installation
1. Clone the repository:
```
git clone https://github.com/rmarchet/react-rollup-template.git
cd react-rollup-template
```

2. Install dependencies:
```
npm install
# or
yarn install
```

## Available Scripts
In the project directory, you can run:

`npm start` or `yarn start`  
Runs the app in development mode with live reloading.<br> Open http://localhost:3000 to view it in the browser.

`npm run build` or `yarn build`  
Builds the app for production to the `dist` folder.  
The build is minified and optimized for best performance.

## Project Structure
```
react-rollup-template/
├── dist/                   # Build output
├── public/                 # Static assets
│   ├── favicon.ico
│   ├── favicon.png
│   └── index.html          # HTML template
├── src/                    # Source code
│   ├── components/         # React components
│   │   └── App.jsx
│   ├── styles/             # CSS styles
│   │   └── main.css
│   └── index.jsx           # Application entry point
├── .babelrc                # Babel configuration
├── .gitignore
├── LICENSE                 # MIT License
├── package.json            # Dependencies and scripts
├── README.md
└── rollup.config.mjs       # Rollup configuration

```

## Customization
- Edit App.jsx to change the main application component
- Add your CSS styles in main.css
- Modify rollup.config.mjs to customize your build process
## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Author
Roberto Marchetti - rmarchet@gmail.com