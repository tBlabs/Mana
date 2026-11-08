import './LoginPage.css'

type Props = {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: Props) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-brand">Mana</h1>
        <p className="login-lead">Otwórz tracker aktywów i wydatków.</p>
        <button type="button" className="login-submit" onClick={onLogin}>
          Zaloguj
        </button>
      </div>
    </div>
  )
}
