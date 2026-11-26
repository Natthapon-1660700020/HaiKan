import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  title,
  close,
  busy = false,
  children,
}: {
  title: string
  close: () => void
  busy?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const heading = useId()
  useEffect(() => {
    const element = ref.current!
    const trigger = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [])
  return createPortal(
    <dialog
      className="task-dialog panel"
      ref={ref}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.stopPropagation()
        e.preventDefault()
        if (!busy) close()
      }}
    >
      <div className="dialog-heading">
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={close}
        >
          ปิดหน้าต่าง
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  )
}
