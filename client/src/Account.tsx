import { useState, type FormEvent } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router'
import { HeartHandshake, LogIn } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAction, useUser } from './api'
import { ErrorBox, notify, Skeleton } from './ui'
export function RequireUser({ children }: { children: ReactNode }) {
  const me = useUser(),
    location = useLocation()
  if (me.isPending) return <Skeleton />
  if (me.error)
    return <ErrorBox error={me.error} retry={() => void me.refetch()} />
  return me.data?.user ? (
    children
  ) : (
    <Navigate
      replace
      to={
        '/login?next=' + encodeURIComponent(location.pathname + location.search)
      }
    />
  )
}
export default function Account({ register = false }: { register?: boolean }) {
  const action = useAction(),
    navigate = useNavigate(),
    [params] = useSearchParams()
  const [problem, setProblem] = useState('')
  const target = params.get('next') || '/'
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProblem('')
    const form = new FormData(e.currentTarget)
    if (register && form.get('password') !== form.get('confirm')) {
      setProblem('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    try {
      await action.mutateAsync({
        path: '/auth/' + (register ? 'register' : 'login'),
        body: {
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        },
      })
      notify(register ? 'สมัครสมาชิกแล้ว' : 'เข้าสู่ระบบแล้ว')
      navigate(/^\/(?!\/)[^\\]*$/.test(target) ? target : '/', {
        replace: true,
      })
    } catch {
      /* Feedback is rendered below. */
    }
  }
  return (
    <section className="panel account">
      <HeartHandshake size={36} className="green" />
      <h1>{register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1>
      <p className="muted">ใช้บัญชีเดียวกันสำหรับให้และรับสิ่งของ</p>
      <form onSubmit={submit}>
        {register && (
          <label>
            ชื่อที่แสดง
            <input
              name="name"
              required
              maxLength={80}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          อีเมล
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
          />
        </label>
        <label>
          รหัสผ่าน
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
        </label>
        {register && (
          <>
            <small>รหัสผ่านอย่างน้อย 8 ตัวอักษร</small>
            <label>
              ยืนยันรหัสผ่าน
              <input
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
              />
            </label>
          </>
        )}
        <ErrorBox error={problem ? new Error(problem) : action.error} />
        <button className="primary" disabled={action.isPending}>
          <LogIn size={17} />
          {register ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}
        </button>
      </form>
      <Link
        className="text-link"
        to={(register ? '/login' : '/register') + '?' + params}
      >
        {register ? 'มีบัญชีแล้ว เข้าสู่ระบบ' : 'ยังไม่มีบัญชี สมัครสมาชิก'}
      </Link>
    </section>
  )
}
