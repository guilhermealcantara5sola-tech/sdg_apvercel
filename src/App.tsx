import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Posts from './pages/Posts';
import Analytics from './pages/Analytics';
import Inbox from './pages/Inbox';
import Broadcast from './pages/Broadcast';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="posts" element={<Posts />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="broadcast" element={<Broadcast />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

