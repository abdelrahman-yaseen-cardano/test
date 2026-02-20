/**
 * main.js – Application entry point
 * Initialises Zustand actions then mounts the React app.
 */
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import { App } from './App.js'
import { initActions } from './actions.js'

// Wire business logic actions into the store
initActions()

// Mount React
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(React.createElement(App))
