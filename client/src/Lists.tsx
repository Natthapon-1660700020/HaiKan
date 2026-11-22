import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { api, HttpError, useClaims, useMine } from './api'
import { claimStates, formatTime, states, windowText, type Item } from './model'
import { useSaved } from './saved'
import { Card, Empty, ErrorBox, Picture, Skeleton } from './ui'
import { ClaimActions } from './Management'
export function Mine() {
  const q = useMine()
  return (
    <>
      <div className="page-head">
        <h1>ประกาศของฉัน</h1>
        <Link className="primary" to="/items/new">
          <Plus size={17} />
          ลงประกาศ
        </Link>
      </div>
      {q.isPending ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="grid-items">
          {q.data.map((item) => (
            <Card item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <Empty>คุณยังไม่มีประกาศ</Empty>
      )}
    </>
  )
}
export function Claims() {
  const q = useClaims()
  return (
    <>
      <h1 className="page-title">คำขอของฉัน</h1>
      {q.isPending ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="record-list">
          {q.data.map((c) => (
            <article className="panel claim-row" key={c.id}>
              <div className="thumb">
                <Picture src={c.item.image} alt="" />
              </div>
              <div>
                <h2>
                  {c.item.hiddenAt ? (
                    c.item.title
                  ) : (
                    <Link to={'/items/' + c.itemId}>{c.item.title}</Link>
                  )}
                </h2>
                <strong>
                  {claimStates[c.state]}
                  {c.position ? ' · คิวที่ ' + c.position : ''}
                </strong>
                <p>
                  {c.item.hiddenAt
                    ? 'อยู่ระหว่างตรวจสอบ · ระงับการจอง'
                    : states[c.item.state]}{' '}
                  ·{' '}
                  {c.state === 'CONFIRMED' && !c.item.endsAt
                    ? 'รอนัดรับ'
                    : windowText(c.item)}
                </p>
                {c.deadline && <p>ครบกำหนด {formatTime(c.deadline)}</p>}
                {[...new Set([c.reason, c.item.reason].filter(Boolean))].map(
                  (r) => (
                    <p key={r}>เหตุผล · {r}</p>
                  ),
                )}
                {c.pickup && (
                  <p>
                    จุดนัดรับ · {c.pickup.pickupPoint}
                    <br />
                    ติดต่อ · {c.pickup.contact}
                  </p>
                )}
                <ClaimActions claim={c} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>คุณยังไม่มีคำขอรับสิ่งของ</Empty>
      )}
    </>
  )
}
export function Saved() {
  const { ids, toggle } = useSaved()
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['saved-detail', id],
      queryFn: async () => {
        try {
          return await api<Item | null>('/saved/' + id)
        } catch (e) {
          if (e instanceof HttpError && e.status === 404) return null
          throw e
        }
      },
    })),
  })
  return (
    <>
      <h1 className="page-title">บันทึกไว้</h1>
      {ids.length ? (
        <div className="grid-items">
          {queries.map((q, i) =>
            q.isPending ? (
              <div key={ids[i]} className="skeleton loading-card" />
            ) : q.error ? (
              <ErrorBox
                key={ids[i]}
                error={q.error}
                retry={() => void q.refetch()}
              />
            ) : q.data ? (
              <Card key={ids[i]} item={q.data} />
            ) : (
              <div key={ids[i]} className="panel">
                <p>ประกาศนี้เปิดดูไม่ได้</p>
                <button className="secondary" onClick={() => toggle(ids[i])}>
                  นำออกจากรายการ
                </button>
              </div>
            ),
          )}
        </div>
      ) : (
        <Empty>คุณยังไม่ได้บันทึกประกาศ กดรูปที่คั่นบนประกาศที่สนใจเพื่อกลับมาดูภายหลัง</Empty>
      )}
    </>
  )
}
