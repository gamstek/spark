import { Theme } from '@radix-ui/themes';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
function Home() { return <main><h1>工作人员平台</h1></main>; }
function Redeem() { const { code } = useParams(); return <main><h1>核销</h1><p>兑奖码：{code}</p></main>; }
export function App() { return <Theme><BrowserRouter basename="/staff"><Routes><Route path="/" element={<Home />} /><Route path="redeem/:code" element={<Redeem />} /></Routes></BrowserRouter></Theme>; }
