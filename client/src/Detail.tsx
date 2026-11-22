import { Link, useParams } from 'react-router'
import {
  CalendarDays,
  ChevronLeft,
  MapPin,
  Package,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { useAction, useDetail, useUser } from './api'
import { claimStates, formatTime, windowText } from './model'
import { Badge, ErrorBox, notify, Picture, Save, Skeleton } from './ui'
import { OwnerTools, ReportForm } from './Management'
export default function DetailPage() {
  const { id = '' } = useParams(),
    query = useDetail(id),
    me = useUser(),
    action = useAction()
  const [accept, setAccept] = useState(false)
  if (query.isPending) return <Skeleton />
  if (query.error)
    return <ErrorBox error={query.error} retry={() => void query.refetch()} />
  const item = query.data,
    user = me.data?.user,
    owner = user?.id === item.ownerId
  const active =
    item.claim &&
    ['WAITING', 'OFFERED', 'CONFIRMED', 'RESCHEDULE'].includes(item.claim.state)
  const eligible =
    !item.hiddenAt &&
    !item.needsWindow &&
    ['OPEN', 'RESERVED'].includes(item.state) &&
    (!item.endsAt || Date.parse(item.endsAt) > Date.now())
  return (
    <>
      <Link className="back" to="/">
        <ChevronLeft size={17} />
        กลับไปยังประกาศทั้งหมด
      </Link>
      <section className="detail-grid">
        <div className="detail-photo">
          <Picture src={item.image} alt={item.title} />
          <Save id={id} />
        </div>
        <div className="detail-copy">
          <Badge item={item} />
          <p className="category-label">
            {item.category} · {item.condition}
          </p>
          <h1>{item.title}</h1>
          <p className="free">ให้ฟรี</p>
          <p>
            <MapPin size={18} />
            {[item.community, item.district, item.province]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p>
            <UserRound size={18} />
            ผู้ให้ {item.owner.name}
          </p>
          <p>
            <CalendarDays size={18} />
            {windowText(item)}
          </p>
          {owner ? (
            item.hiddenAt || ['CLOSED', 'GIVEN'].includes(item.state) ? null : (
              <Link className="secondary" to={'/items/' + id + '/edit'}>
                แก้ไขประกาศ
              </Link>
            )
          ) : active ? (
            <Link to="/claims" className="secondary">
              {claimStates[item.claim!.state]} · ดูคำขอของฉัน
            </Link>
          ) : eligible ? (
            user ? (
              <>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={accept}
                    onChange={(e) => setAccept(e.target.checked)}
                  />
                  ฉันรับของได้ตามเงื่อนไขการนัดรับ
                </label>
                <button
                  className="primary"
                  disabled={!accept || action.isPending}
                  onClick={() =>
                    action.mutate(
                      {
                        path: '/items/' + id + '/claims',
                        body: { acceptsPickup: true },
                      },
                      { onSuccess: () => notify('บันทึกคำขอรับแล้ว') },
                    )
                  }
                >
                  <Package size={17} />
                  {item.state === 'OPEN' ? 'ขอรับสิ่งของ' : 'เข้าคิวสำรอง'}
                </button>
              </>
            ) : (
              <Link className="primary" to={'/login?next=/items/' + id}>
                เข้าสู่ระบบเพื่อขอรับ
              </Link>
            )
          ) : null}
          <ErrorBox error={action.error} />
        </div>
      </section>
      <section className="panel detail-body">
        <h2>รายละเอียดสิ่งของ</h2>
        <p>{item.description}</p>
        {item.contents && (
          <p>
            <b>ของที่อยู่ในชุด</b> {item.contents}
          </p>
        )}
        <h2>
          <ShieldCheck size={21} />
          ข้อมูลนัดรับ
        </h2>
        {item.pickup ? (
          <>
            <p>จุดนัดรับ · {item.pickup.pickupPoint}</p>
            <p>ช่องทางติดต่อ · {item.pickup.contact}</p>
          </>
        ) : (
          <p>ผู้ได้รับสิทธิ์ที่ยืนยันแล้วจะเห็นจุดนัดรับละเอียดและช่องทางติดต่อที่นี่</p>
        )}
        {item.claim?.deadline && (
          <p>ยืนยันภายใน {formatTime(item.claim.deadline)}</p>
        )}
        {item.reason && <p>เหตุผล · {item.reason}</p>}
        <p className="muted">
          รับฟรีทุกประกาศ หากต้องการให้สิ่งตอบแทนโดยสมัครใจ ให้ตกลงกันหลังได้สิทธิ์
          ข้อเสนอนี้ไม่มีผลต่อลำดับคิว
        </p>
      </section>
      {owner && <OwnerTools item={item} />}
      {user && !item.hiddenAt && !item.archivedAt && <ReportForm id={id} />}
    </>
  )
}
