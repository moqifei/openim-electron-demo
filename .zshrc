export PATH="/usr/local/bin/orange:$PATH"

######## nvm 相关配置 start ############
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # 加载 nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # 加载 nvm 的补全功能
######## nvm 相关配置 end ############

# Go 环境变量（让系统识别 go install 安装的命令）
export PATH=$PATH:$(go env GOPATH)/bin

# Added by Comate (zulu-cli)
export PATH="/Users/moqifei/.comate/zulu-cli/bin:$PATH"

# Added by CatPaw
export PATH="/Users/moqifei/.catpawai/bin:$PATH"
# Added by Loop CLI
export PATH="/Users/moqifei/.loop/bin:$PATH"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/moqifei/.lmstudio/bin"
# End of LM Studio CLI section
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

