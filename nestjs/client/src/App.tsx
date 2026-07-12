import { Link, Route, Routes, useNavigate } from 'react-router';
import { api } from './api';
import { useAuth } from './auth';
import { Login } from './pages/Login';
import { PostEditor } from './pages/PostEditor';
import { PostList } from './pages/PostList';
import { PostShow } from './pages/PostShow';
import { Register } from './pages/Register';

export function App() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    setUser(null);
    navigate('/');
  }

  return (
    <div className="container">
      <header>
        <Link to="/" className="brand">
          Minilog
        </Link>
        <nav>
          {!ready ? null : user ? (
            <>
              <Link to="/posts/new">New post</Link>
              <span>{user.name}</span>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<PostList />} />
          <Route path="/posts/new" element={<PostEditor />} />
          <Route path="/posts/:id" element={<PostShow />} />
          <Route path="/posts/:id/edit" element={<PostEditor />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
    </div>
  );
}
