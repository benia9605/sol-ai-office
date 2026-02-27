/**
 * @file src/main.tsx
 * @description 앱 진입점 (Entry Point)
 * - React 앱을 DOM에 마운트하는 최상위 파일
 * - index.html의 #root 요소에 <App /> 컴포넌트를 렌더링
 * - React.StrictMode로 감싸서 개발 중 잠재적 문제를 감지
 * - 글로벌 CSS(index.css)를 여기서 import
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
