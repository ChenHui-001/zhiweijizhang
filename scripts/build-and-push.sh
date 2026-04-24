#!/bin/bash
# ZhiWeiJZ 一键构建并推送Docker镜像
# 用法: ./scripts/build-and-push.sh

set -e

# Docker Hub配置
DOCKER_USERNAME="nanpo"
IMAGE_PREFIX="zhiweijz"

# 镜像列表
IMAGES=(
    "backend:server/Dockerfile"
    "frontend:apps/web/Dockerfile"
    "nginx:docker/Dockerfile.nginx"
)

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 检查参数
SKIP_VERSION_BUMP=false
CUSTOM_VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-version)
            SKIP_VERSION_BUMP=true
            shift
            ;;
        --version)
            CUSTOM_VERSION="$2"
            shift 2
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--skip-version] [--version X.Y.Z]"
            exit 1
            ;;
    esac
done

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo ""
echo -e "${MAGENTA}╔════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║   ZhiWeiJZ Docker 构建和推送脚本               ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════╝${NC}"
echo ""

# 检查Docker是否运行
echo -e "${CYAN}=== 检查Docker状态 ===${NC}"
if ! docker --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker未运行，请先启动Docker${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker已就绪: $(docker --version)${NC}"

# 获取版本号
echo -e "${CYAN}=== 获取当前版本号 ===${NC}"
VERSION_FILE="$PROJECT_ROOT/docker/VERSION"

if [ -n "$CUSTOM_VERSION" ]; then
    NEW_VERSION="$CUSTOM_VERSION"
    echo -e "${YELLOW}📦 使用指定版本: $NEW_VERSION${NC}"
elif [ -f "$VERSION_FILE" ]; then
    CURRENT_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
    echo -e "${YELLOW}📦 当前版本: $CURRENT_VERSION${NC}"
    
    if [ "$SKIP_VERSION_BUMP" = true ]; then
        NEW_VERSION="$CURRENT_VERSION"
        echo -e "${YELLOW}📦 跳过版本号递增${NC}"
    else
        # 解析版本号并递增
        IFS='.' read -ra PARTS <<< "$CURRENT_VERSION"
        PATCH=$((PARTS[2] + 1))
        NEW_VERSION="${PARTS[0]}.${PARTS[1]}.$PATCH"
        echo -e "${YELLOW}📦 新版本: $NEW_VERSION${NC}"
    fi
else
    NEW_VERSION="1.9.2"
    echo -e "${YELLOW}📦 未找到VERSION文件，使用默认版本: $NEW_VERSION${NC}"
fi

# 保存新版本号
echo -n "$NEW_VERSION" > "$VERSION_FILE"
echo -e "${GREEN}✅ 版本号已保存: $NEW_VERSION${NC}"

# 清理旧镜像
echo -e "${CYAN}=== 清理旧镜像 ===${NC}"
for img in "${IMAGES[@]}"; do
    name="${img%%:*}"
    old_image="${DOCKER_USERNAME}/${IMAGE_PREFIX}-${name}:latest"
    echo -e "${YELLOW}📦 移除旧镜像: $old_image${NC}"
    docker rmi "$old_image" 2>/dev/null || true
done

# 构建并推送每个镜像
echo -e "${CYAN}=== 开始构建和推送镜像 ===${NC}"
echo ""

FAILED_IMAGES=()

for img_spec in "${IMAGES[@]}"; do
    IFS=':' read -ra IMG_INFO <<< "$img_spec"
    IMAGE_NAME="${IMG_INFO[0]}"
    DOCKERFILE_PATH="${IMG_INFO[1]}"
    FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_PREFIX}-${IMAGE_NAME}"
    
    echo -e "${MAGENTA}──────────────────────────────────────${NC}"
    
    # 构建镜像
    echo -e "${CYAN}=== 构建 ${FULL_IMAGE_NAME}:${NEW_VERSION} ===${NC}"
    echo -e "${YELLOW}📦 使用 Dockerfile: $DOCKERFILE_PATH${NC}"
    
    if ! docker build -f "$DOCKERFILE_PATH" -t "${FULL_IMAGE_NAME}:${NEW_VERSION}" -t "${FULL_IMAGE_NAME}:latest" .; then
        echo -e "${RED}❌ 构建失败: $IMAGE_NAME${NC}"
        FAILED_IMAGES+=("$IMAGE_NAME")
        continue
    fi
    echo -e "${GREEN}✅ 构建成功: $IMAGE_NAME${NC}"
    
    # 推送镜像
    echo -e "${CYAN}=== 推送 ${FULL_IMAGE_NAME}:${NEW_VERSION} ===${NC}"
    
    if ! docker push "${FULL_IMAGE_NAME}:${NEW_VERSION}"; then
        echo -e "${RED}❌ 推送版本标签失败: $IMAGE_NAME${NC}"
        FAILED_IMAGES+=("$IMAGE_NAME")
        continue
    fi
    echo -e "${GREEN}✅ 推送版本标签完成${NC}"
    
    if ! docker push "${FULL_IMAGE_NAME}:latest"; then
        echo -e "${RED}❌ 推送latest标签失败: $IMAGE_NAME${NC}"
        FAILED_IMAGES+=("$IMAGE_NAME")
        continue
    fi
    echo -e "${GREEN}✅ 推送latest标签完成${NC}"
    
    echo ""
done

# 输出结果
echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════${NC}"

if [ ${#FAILED_IMAGES[@]} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 全部镜像构建并推送成功！${NC}"
    echo ""
    echo -e "镜像版本: ${CYAN}$NEW_VERSION${NC}"
    echo ""
    echo "推送的镜像:"
    for img_spec in "${IMAGES[@]}"; do
        name="${img_spec%%:*}"
        FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_PREFIX}-${name}"
        echo -e "  • ${YELLOW}${FULL_IMAGE_NAME}:${NEW_VERSION}${NC}"
    done
    echo ""
    echo "部署命令:"
    echo -e "  ${CYAN}BACKEND_IMAGE_VERSION=$NEW_VERSION${NC}"
    echo -e "  ${CYAN}FRONTEND_IMAGE_VERSION=$NEW_VERSION${NC}"
    echo -e "  ${CYAN}NGINX_IMAGE_VERSION=$NEW_VERSION${NC}"
    echo ""
    echo -e "${MAGENTA}════════════════════════════════════════════════${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  部分镜像推送失败:${NC}"
    for failed in "${FAILED_IMAGES[@]}"; do
        echo -e "  • ${RED}$failed${NC}"
    done
    echo ""
    echo -e "${MAGENTA}════════════════════════════════════════════════${NC}"
    exit 1
fi
