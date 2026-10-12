| カテゴリ       | オプション                       | デフォルト | 説明                                                                                |
| -------------- | -------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| Kubernetes     | `--kubeconfig`                   | None       | kubeconfig のパス（未指定なら自動検出）                                             |
| Kubernetes     | `--as`                           | None       | ユーザー偽装                                                                        |
| Kubernetes     | `--as-group`                     | None       | グループ偽装                                                                        |
| Kubernetes     | `--context` / `--cluster`        | None       | 実行対象クラスタ（未指定なら現在のクラスタ）                                        |
| Kubernetes     | `--all-clusters`                 | -          | 全クラスタで実行                                                                    |
| Kubernetes     | `--namespace`                    | None       | 対象 namespace（未指定なら `kube-system` 以外の全て）                               |
| Kubernetes     | `--resource`                     | None       | 対象リソース種別（Deployment, StatefulSet, DaemonSet, Job, Rollout, StrimziPodSet） |
| Kubernetes     | `--selector`                     | None       | ワークロードのラベルで絞り込み（Pod のラベルではない）                              |
| Prometheus     | `--prometheus-url`               | None       | Prometheus の URL（未指定なら自動検出）                                             |
| Prometheus     | `--prometheus-auth-header`       | None       | 認証ヘッダー                                                                        |
| Prometheus     | `--prometheus-headers`           | None       | 追加ヘッダー（`'key: value'` 形式）                                                 |
| Prometheus     | `--prometheus-ssl-enabled`       | -          | SSL を有効化                                                                        |
| Prometheus     | `--prometheus-cluster-label`     | None       | クラスタを示すラベル値（集中型のみ）                                                |
| Prometheus     | `--prometheus-label`             | None       | クラスタを区別するラベル名（集中型のみ）                                            |
| EKS            | `--eks-managed-prom`             | -          | EKS 接続用の署名を追加                                                              |
| EKS            | `--eks-profile-name`             | None       | プロファイル名                                                                      |
| EKS            | `--eks-access-key`               | None       | アクセスキー                                                                        |
| EKS            | `--eks-secret-key`               | None       | シークレットキー                                                                    |
| EKS            | `--eks-service-name`             | aps        | サービス名                                                                          |
| EKS            | `--eks-managed-prom-region`      | None       | リージョン                                                                          |
| EKS            | `--eks-assume-role`              | None       | 引き受けるロール（クロスアカウント用）                                              |
| Coralogix      | `--coralogix-token`              | None       | Coralogix 用トークン                                                                |
| OpenShift      | `--openshift`                    | -          | ServiceAccount のトークンで接続                                                     |
| Recommendation | `--cpu-min`                      | 10         | 推奨 CPU の最小値（ミリコア）                                                       |
| Recommendation | `--mem-min`                      | 100        | 推奨メモリの最小値（MB）                                                            |
| Threading      | `--max-workers`                  | 10         | 非同期リクエストの最大ワーカー数                                                    |
| Job Grouping   | `--job-grouping-labels`          | None       | Job をグループ化するラベル名（カンマ区切り可）                                      |
| Job Grouping   | `--job-grouping-limit`           | 500        | 1グループあたりの最大 Job/Pod 数                                                    |
| Job Discovery  | `--discovery-job-batch-size`     | 5000       | Job API 呼び出しのバッチサイズ                                                      |
| Job Discovery  | `--discovery-job-max-batches`    | 100        | 処理する Job バッチの最大数                                                         |
| Logging        | `--formatter`                    | table      | 出力形式（json, pprint, table, yaml, csv, csv-raw, html）                           |
| Logging        | `--verbose`                      | -          | 詳細ログ                                                                            |
| Logging        | `--quiet`                        | -          | 静音モード                                                                          |
| Logging        | `--logtostderr`                  | -          | ログを stderr に出力                                                                |
| Logging        | `--width`                        | None       | 出力幅（未指定ならコンソール幅）                                                    |
| Output         | `--show-cluster-name`            | -          | 単一クラスタでもクラスタ名を表示                                                    |
| Output         | `--exclude-severity`             | True       | 出力に severity を含めるか                                                          |
| Output         | `--fileoutput`                   | None       | 出力先ファイル名                                                                    |
| Output         | `--fileoutput-dynamic`           | -          | `krr-{datetime}.{format}` でカレントに出力                                          |
| Output         | `--slackoutput`                  | None       | Slack に送信（`SLACK_BOT_TOKEN` が必要）                                            |
| Output         | `--slacktitle`                   | None       | Slack メッセージのタイトル                                                          |
| Output         | `--azurebloboutput`              | None       | Azure Blob Storage の SAS URL（コンテナ含む）                                       |
| Output         | `--teams-webhook`                | None       | Teams の Webhook URL                                                                |
| Output         | `--azure-subscription-…`         | None       | Teams 通知用のサブスクリプション ID（名前は途中まで表示）                           |
| Output         | `--azure-resource-group`         | None       | Teams 通知用のリソースグループ                                                      |
| Publish Scan   | `--publish_scan_url`             | None       | robusta_runner へ結果を送信                                                         |
| Publish Scan   | `--start_time`                   | None       | スキャンの開始時刻                                                                  |
| Publish Scan   | `--scan_id`                      | None       | スキャン識別用 UUID                                                                 |
| Publish Scan   | `--named_sinks`                  | None       | 送信先 sink のリスト                                                                |
| Strategy       | `--history-duration`             | 336        | 履歴データの期間（時間）                                                            |
| Strategy       | `--timeframe-duration`           | 1.25       | 履歴データのステップ（分）                                                          |
| Strategy       | `--cpu_percentile`               | 95         | CPU 推奨のパーセンタイル                                                            |
| Strategy       | `--memory_buffer_percentage`     | 15         | メモリ推奨の上乗せバッファ（%）                                                     |
| Strategy       | `--points-required`              | 100        | 推奨に必要なデータポイント数                                                        |
| Strategy       | `--allow_hpa`                    | -          | HPA 設定済みでも推奨値を算出                                                        |
| Strategy       | `--use_oomkill_data`             | -          | OOMKill 検出時にメモリを引き上げ（experimental）                                    |
| Strategy       | `--oom_memory_buffer_percentage` | 25         | OOMKill 時にメモリを増やす割合（%）                                                 |
