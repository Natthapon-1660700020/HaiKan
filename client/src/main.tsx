import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Bookmark, LogIn, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Admin from './Admin'
import Catalog from './Catalog'
import ItemForm, { EditPage } from './ItemForm'
import Detail from './Detail'
import Account, { RequireUser } from './Account'
import { Claims, Mine, Saved } from './Lists'
import { useAction, useUser } from './api'
import { Toast, notify, ErrorBox } from './ui'
import './style.css'
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 3000, refetchInterval: 15000 },
  },
})
function App() {
  const [open, setOpen] = useState(false),
    loc = useLocation(),
    nav = useNavigate(),
    me = useUser(),
    logout = useAction()
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])
  const user = me.data?.user
  return (
    <>
      <a className="skip" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <header>
        <div className="topbar">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" />
            <b>HaiKan</b>
            <span>(ให้กัน)</span>
          </Link>
          <button
            className="mobile-menu"
            aria-label="เมนู"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav className={open ? 'open' : ''} aria-label="เมนูหลัก">
            <NavLink end to="/">
              สำรวจของ
            </NavLink>
            <NavLink to="/saved">
              <Bookmark size={16} />
              บันทึกไว้
            </NavLink>
            {user && (
              <>
                <NavLink to="/claims">คำขอของฉัน</NavLink>
                <NavLink to="/mine">ประกาศของฉัน</NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin">ตรวจประกาศ</NavLink>
                )}
              </>
            )}
            {user ? (
              <button
                className="secondary"
                onClick={() =>
                  logout.mutate(
                    { path: '/auth/logout' },
                    {
                      onSuccess: () => {
                        notify('ออกจากระบบแล้ว')
                        nav('/')
                      },
                    },
                  )
                }
              >
                ออกจากระบบ
              </button>
            ) : (
              <Link className="login" to="/login">
                <LogIn size={16} />
                เข้าสู่ระบบ
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="shell">
        <ErrorBox error={logout.error} />
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route
            path="/items/new"
            element={
              <RequireUser>
                <ItemForm />
              </RequireUser>
            }
          />
          <Route
            path="/items/:id/edit"
            element={
              <RequireUser>
                <EditPage />
              </RequireUser>
            }
          />
          <Route path="/items/:id" element={<Detail />} />
          <Route
            path="/mine"
            element={
              <RequireUser>
                <Mine />
              </RequireUser>
            }
          />
          <Route
            path="/claims"
            element={
              <RequireUser>
                <Claims />
              </RequireUser>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireUser>
                <Admin />
              </RequireUser>
            }
          />
          <Route path="/saved" element={<Saved />} />
          <Route
            path="/register"
            element={<Account key="register" register />}
          />
          <Route path="/login" element={<Account key="login" />} />
          <Route
            path="*"
            element={
              <section className="empty">
                <h1>ไม่พบหน้านี้</h1>
                <Link to="/">กลับไปสำรวจของ</Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer>
        <div>
          <b>HaiKan (ให้กัน)</b>
          <span>พื้นที่ส่งต่อของในชุมชน</span>
        </div>
      </footer>
      <Toast />
    </>
  )
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
)
