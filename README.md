# krr-dashboard

KubernetesにおけるPodの推奨CPUとMemoryをWebで可視化するツール

画面の`再生成ボタン`または`CronJob`で`krr`を実行

## ローカル起動

`tests/krr.csv`を読み込む

`http://localhost:8080`で確認

```powershell
$Port = 8080

python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

$env:DATA_DIR = "$PWD\.localdata"
$env:KRR_WORKDIR = "$PWD"
$env:KRR_COMMAND = 'python -c "import sys; sys.stdout.write(open(''tests/krr.csv'', encoding=''utf-8'').read())"'

.venv\Scripts\uvicorn dashboard.main:app --port $Port
```

## Build/Push

```bash
DOCKER_USER=metalmental
IMAGE=${DOCKER_USER}/krr-dashboard
TAG=0.1.0
```

```bash
docker build -t ${IMAGE}:${TAG} .
docker login
docker push ${IMAGE}:${TAG}
```

## Kubernetesデプロイ

Podの配置先は、`mouse`と`nipogi` Nodeに限定している

`http://<ノードの IP>:30016` を開く

```bash
kubectl apply -f k8s/
```
