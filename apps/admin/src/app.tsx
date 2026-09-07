import { Theme } from '@radix-ui/themes';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
function Home() { return <main><h1>运营管理后台</h1></main>; }
function Activities() { return <main><h1>活动管理</h1></main>; }
export function App() { return <Theme><BrowserRouter basename="/admin"><Routes><Route path="/" element={<Home />} /><Route path="activities" element={<Activities />} /></Routes></BrowserRouter></Theme>; }
