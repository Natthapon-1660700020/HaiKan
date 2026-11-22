import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api, useAction } from './api'
import { claimStates, type Claim, type Detail, type MyClaim } from './model'
import { ErrorBox, notify } from './ui'

export function ClaimActions({ claim }: { claim: MyClaim }) {
  const action = useAction()
  if (
    claim.item.hiddenAt ||
    !['WAITING', 'OFFERED', 'CONFIRMED', 'RESCHEDULE'].includes(claim.state)
  )
    return null
  const act = (choice: 'accept' | 'withdraw') =>
    action.mutate(
      {
        path: '/items/' + claim.itemId + '/claims/' + claim.id,
        method: 'PATCH',
        body: { action: choice },
      },
      { onSuccess: () => notify('อัปเดตคำขอแล้ว') },
    )
  return (
    <>
      <div className="actions">
        {['OFFERED', 'RESCHEDULE'].includes(claim.state) &&
          !claim.item.needsWindow && (
            <button
              className="primary"
              disabled={action.isPending}
              onClick={() => act('accept')}
            >
              ยืนยันสิทธิ์และเวลานัด
            </button>
          )}
        <button
          className="secondary"
          disabled={action.isPending}
          onClick={() => {
            if (window.confirm('ยืนยันการสละสิทธิ์ในคำขอนี้หรือไม่')) act('withdraw')
          }}
        >
          สละสิทธิ์
        </button>
      </div>
      <ErrorBox error={action.error} />
    </>
  )
}
export function OwnerTools({ item }: { item: Detail }) {
  const action = useAction(),
    navigate = useNavigate(),
    [tool, setTool] = useState('')
  const history = useQuery({
    queryKey: ['history', item.id],
    queryFn: () =>
      api<(Claim & { user: { name: string } })[]>(
        '/items/' + item.id + '/history',
      ),
  })
  const terminal = ['CLOSED', 'GIVEN'].includes(item.state),
    base = '/items/' + item.id
  const send = (path: string, method: string, body?: unknown) =>
    action.mutate(
      { path, method, body },
      {
        onSuccess: () => {
          setTool('')
          notify('อัปเดตประกาศแล้ว')
          if (method === 'DELETE') navigate('/mine')
        },
      },
    )
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fields = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >
    if (tool === 'window')
      send(base + '/window', 'PATCH', {
        reason: fields.reason,
        startsAt: new Date(fields.start).toISOString(),
        endsAt: new Date(fields.end).toISOString(),
      })
    else send(base + '/close', 'PATCH', { reason: fields.reason })
  }
  return (
    <section className="panel detail-body">
      <h2>จัดการประกาศและคำขอ</h2>
      {item.archivedAt ? (
        <p>นำออกจากหน้าสาธารณะแล้ว</p>
      ) : (
        terminal && (
          <button
            className="secondary"
            disabled={action.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'นำประกาศออกจากหน้าสาธารณะหรือไม่? เจ้าของและผู้ที่เคยขอรับยังดูประวัติได้',
                )
              ) {
                send(base + '/archive', 'PATCH')
              }
            }}
          >
            นำออกจากหน้าสาธารณะ
          </button>
        )
      )}
      {item.hiddenAt && <p>อยู่ระหว่างตรวจสอบ · {item.reason}</p>}
      {!terminal && !item.hiddenAt && (
        <>
          <div className="actions">
            <button
              className="secondary"
              onClick={() => setTool(tool === 'window' ? '' : 'window')}
            >
              กำหนดนัดใหม่
            </button>
            {item.hasHistory ? (
              <button
                className="danger"
                onClick={() => setTool(tool === 'close' ? '' : 'close')}
              >
                ปิดประกาศ
              </button>
            ) : (
              <button
                className="danger"
                disabled={action.isPending}
                onClick={() => {
                  if (window.confirm('ยืนยันการลบประกาศนี้หรือไม่'))
                    send(base, 'DELETE')
                }}
              >
                ลบประกาศ
              </button>
            )}
          </div>
          {tool && (
            <form key={tool} onSubmit={submit}>
              {tool === 'window' && (
                <div className="form-row">
                  <label>
                    วันเวลาเริ่ม
                    <input required type="datetime-local" name="start" />
                  </label>
                  <label>
                    วันเวลาสิ้นสุด
                    <input required type="datetime-local" name="end" />
                  </label>
                </div>
              )}
              <label>
                {tool === 'window' ? 'เหตุผลที่กำหนดนัดใหม่' : 'เหตุผลที่ปิดประกาศ'}
                <textarea required name="reason" maxLength={500} />
              </label>
              <button className="primary" disabled={action.isPending}>
                {tool === 'window' ? 'เสนอช่วงนัดรับ' : 'ยืนยันปิดประกาศ'}
              </button>
            </form>
          )}
        </>
      )}
      <ErrorBox
        error={action.error || history.error}
        retry={history.error ? () => void history.refetch() : undefined}
      />
      {history.isPending ? (
        <p>กำลังโหลดคำขอ…</p>
      ) : history.data?.length ? (
        history.data.map((c) => (
          <div className="history" key={c.id}>
            <b>{c.user.name}</b> · {claimStates[c.state]}
            {c.state === 'CONFIRMED' && !item.endsAt ? ' · รอนัดรับ' : ''}
            {c.reason && <p>{c.reason}</p>}
            {!terminal &&
              !item.hiddenAt &&
              ['CONFIRMED', 'OFFERED', 'RESCHEDULE'].includes(c.state) && (
                <>
                  {item.needsWindow || !item.endsAt ? (
                    <p>
                      กด “กำหนดนัดใหม่” เพื่อเสนอช่วงนัดรับ แล้วให้ผู้รับยืนยันในหน้า
                      “คำขอของฉัน”
                    </p>
                  ) : (
                    c.state !== 'CONFIRMED' && (
                      <p>
                        รอผู้รับยืนยันสิทธิ์และเวลานัดในหน้า “คำขอของฉัน” ก่อนบันทึกการส่งมอบ
                      </p>
                    )
                  )}
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={
                        action.isPending ||
                        item.needsWindow ||
                        !item.startsAt ||
                        !item.endsAt ||
                        c.state !== 'CONFIRMED'
                      }
                      onClick={() => {
                        if (window.confirm('ส่งมอบสิ่งของให้ผู้รับจริงแล้วหรือไม่'))
                          send(base + '/claims/' + c.id, 'PATCH', {
                            action: 'complete',
                          })
                      }}
                    >
                      ส่งต่อแล้ว
                    </button>
                    {c.state === 'CONFIRMED' &&
                      !item.needsWindow &&
                      item.endsAt &&
                      Date.parse(item.endsAt) <= Date.now() && (
                        <button
                          className="danger"
                          disabled={action.isPending}
                          onClick={() => {
                            if (window.confirm('ยืนยันว่าผู้รับผิดนัดหรือไม่'))
                              send(base + '/claims/' + c.id, 'PATCH', {
                                action: 'missed',
                              })
                          }}
                        >
                          ยืนยันว่าผิดนัด
                        </button>
                      )}
                  </div>
                </>
              )}
          </div>
        ))
      ) : (
        <p>ยังไม่มีคำขอรับ</p>
      )}
    </section>
  )
}
export function ReportForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false),
    action = useAction()
  return (
    <section className="panel detail-body">
      <button className="text-link" onClick={() => setOpen(!open)}>
        รายงานประกาศ
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const reason = new FormData(e.currentTarget).get('reason')
            action.mutate(
              { path: '/items/' + id + '/report', body: { reason } },
              {
                onSuccess: () => {
                  notify('ส่งรายงานให้ผู้ดูแลแล้ว')
                  setOpen(false)
                },
              },
            )
          }}
        >
          <label>
            เหตุผลที่รายงาน
            <textarea name="reason" required maxLength={500} />
          </label>
          <button className="secondary" disabled={action.isPending}>
            ส่งรายงาน
          </button>
          <ErrorBox error={action.error} />
        </form>
      )}
    </section>
  )
}
