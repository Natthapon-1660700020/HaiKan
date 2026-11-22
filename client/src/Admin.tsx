import { useQuery } from '@tanstack/react-query'
import { api, useAction } from './api'
import { Empty, ErrorBox, notify, Skeleton } from './ui'
import { formatTime, type State } from './model'
type Report = {
  id: number
  reason: string
  createdAt: string
  user: { name: string; email: string }
  item: {
    id: string
    title: string
    hiddenAt: string | null
    state: State
    decisions: { action: string; reason: string; createdAt: string }[]
  }
}
const choices: Record<string, string> = {
  hide: 'ซ่อนชั่วคราว',
  restore: 'เปิดคืน',
  close: 'ปิดประกาศ',
}
function ReportRow({ report }: { report: Report }) {
  const action = useAction(),
    item = report.item,
    options = item.hiddenAt ? ['restore', 'close'] : ['hide', 'close']
  return (
    <article className="panel">
      <h2>{item.title}</h2>
      <p>
        ผู้รายงาน {report.user.name} · {report.user.email}
      </p>
      <p>
        {formatTime(report.createdAt)} · {report.reason}
      </p>
      {item.decisions.map((d) => (
        <p key={d.createdAt}>
          {choices[d.action]} · {d.reason}
        </p>
      ))}
      {item.state !== 'CLOSED' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fields = Object.fromEntries(new FormData(e.currentTarget))
            action.mutate(
              {
                path: '/admin/items/' + item.id,
                method: 'PATCH',
                body: fields,
              },
              { onSuccess: () => notify('บันทึกผลการตรวจแล้ว') },
            )
          }}
        >
          <label>
            ผลการตรวจ
            <select name="action" key={String(item.hiddenAt)}>
              {options
                .filter((k) => !(k === 'close' && item.state === 'GIVEN'))
                .map((k) => (
                  <option key={k} value={k}>
                    {choices[k]}
                  </option>
                ))}
            </select>
          </label>
          <label>
            เหตุผลของผู้ดูแล
            <textarea required name="reason" maxLength={500} />
          </label>
          <button className="secondary" disabled={action.isPending}>
            บันทึกผลการตรวจ
          </button>
        </form>
      )}
      <ErrorBox error={action.error} />
    </article>
  )
}
export default function Admin() {
  const q = useQuery({
    queryKey: ['reports'],
    queryFn: () => api<Report[]>('/admin/reports'),
  })
  return (
    <>
      <h1 className="page-title">ตรวจประกาศ</h1>
      {q.isPending ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="record-list">
          {q.data.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </div>
      ) : (
        <Empty>ยังไม่มีรายงานประกาศ</Empty>
      )}
    </>
  )
}
