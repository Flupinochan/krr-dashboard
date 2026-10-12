FROM robustadev/krr:v1.30.0

LABEL org.opencontainers.image.title="krr-dashboard" \
      org.opencontainers.image.description="Web dashboard for krr (Kubernetes Resource Recommender) recommendations" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /opt/krr-dashboard

COPY requirements.txt .
# krr は pydantic 1.x を固定しており、FastAPI と同居できないため専用 venv に分離する
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY LICENSE ./LICENSE
COPY dashboard ./dashboard

# 名前解決に依存しないよう、ベースで削られている可能性のある useradd を使わず直接登録する
RUN echo "dashboard:x:10001:10001:dashboard:/nonexistent:/usr/sbin/nologin" >> /etc/passwd \
    && echo "dashboard:x:10001:" >> /etc/group

ENV DATA_DIR=/data \
    KRR_WORKDIR=/app \
    MPLCONFIGDIR=/tmp/matplotlib

USER 10001:10001

EXPOSE 8000

CMD ["/opt/venv/bin/uvicorn", "dashboard.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
