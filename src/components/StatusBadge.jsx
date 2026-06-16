const STATUS_LABELS = {
  new: 'New',
  no_answer: 'No Answer',
  follow_up: 'Follow Up',
  in_the_money: '💰 In The Money',
  not_interested: 'Not Interested',
  monkey: '🐒 Monkey',
  broke: 'Broke',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export { STATUS_LABELS }
