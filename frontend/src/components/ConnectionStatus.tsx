type ConnectionStatusProps = {
  connected: boolean;
};

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return <div className={`connection-status ${connected ? 'is-online' : 'is-offline'}`}>{connected ? '接続中' : '切断中'}</div>;
}
