zmodload zsh/zprof

alias v=nvim
alias lg=lazygit

# bindkey -l    --- to list all variants
# bindkey -M    --- to read key binds in specified scheme
#bindkey -v 

# custom git settings to manage dot files
# see https://www.atlassian.com/git/tutorials/dotfiles
# run on new machine:
# dot config --local status.showUntrackedFiles no
alias dot='git --git-dir=$HOME/.git_dot/ --work-tree=$HOME'
alias ld="lazygit -w $HOME -g $HOME/.git_dot/"

# file with aliases
if [[ -f "$HOME/.aliases" ]]; then
  . $HOME/.aliases
fi

# allow v to edit the command line (standard behaviour)
#autoload -Uz edit-command-line
#zle -N edit-command-line
bindkey '^v' edit-command-line

# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# themes can be found here: .oh-my-zsh/themes/
# See https://github.com/robbyrussell/oh-my-zsh/wiki/Themes
# ZSH_THEME="avit"
# ZSH_THEME="eastwood"
# ZSH_THEME="af-magic"
# ZSH_THEME="kennethreitz"
# ZSH_THEME="nanotech"
# ZSH_THEME="common"
# avit, eastwood 
ZSH_THEME="dokwork"

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in ~/.oh-my-zsh/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment the following line to disable bi-weekly auto-update checks.
# DISABLE_AUTO_UPDATE="true"

# Uncomment the following line to automatically update without prompting.
# DISABLE_UPDATE_PROMPT="true"

# Uncomment the following line to change how often to auto-update (in days).
# export UPDATE_ZSH_DAYS=13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS=true

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in ~/.oh-my-zsh/plugins/*
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git history docker docker-compose)

source $ZSH/oh-my-zsh.sh

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='nvim'
else
  export EDITOR='nvim'
fi

# Enable Ctrl-x-e to edit command line
autoload -U edit-command-line
# Emacs style
zle -N edit-command-line
bindkey '^v' edit-command-line

# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"


export USE_GKE_GCLOUD_AUTH_PLUGIN=True
export KUBE_EDITOR="nvim"

if [ -x "$(command -v kubectl)" ]; then
   source <(kubectl completion zsh)
fi

export PATH="$HOME/.pyenv/bin:$HOME/.local/bin:$HOME/go/bin:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$HOME/.cargo/bin:$PATH"
export SBT_OPTS="-Xmx8G -XX:+UseG1GC"
# eval "$(pyenv init -)"
# eval "$(pyenv virtualenv-init -)"

export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -f -g ""'

export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
export DOCKER_HOST="unix://${HOME}/.colima/docker.sock"

# ==============================================================================
#                               nnn configuration
# ==============================================================================

# Bookmarks: set environment variable NNN_BMS as a string of
# key_char:location pairs separated by semicolons (;):
export PROJECTS=$HOME'/Projects'
export VIM_PATH=$HOME'/.vim'
export NVIM_PATH=$HOME'/.config/nvim'
export NVIM_PLUG=$HOME'/.local/share/nvim/site/pack/packer/start'

B_HOME='h:'$HOME';'
B_PROJECTS='p:'$PROJECTS';'
B_VIM='v:'$VIM_PATH'/plugged;'
B_NVIM='V:'$NVIM_PATH';'
B_NVIMP='P:'$NVIM_PLUG';'

if [[ -f "$HOME/Projects/dash/" ]]; then
  B_DASH='d:'$PROJECTS'/dash;'
  B_DASH_WIKI='w:'$PROJECTS'/dash.wiki;'
fi

export NNN_BMS=$B_HOME$B_PROJECTS$B_DASH$B_DASH_WIKI$B_VIM$B_NVIM$B_GDISK$B_SETTINGS$B_NVIMP

export NNN_OPENER="$HOME/.config/nnn/plugins/nuke"

# setup FIFO for preview feature
export NNN_FIFO='/tmp/nnn.fifo'

# useful plugins:
export NNN_PLUG='f:fzopen;n:nuke;d:diffs;i:batview;v:imgview;p:preview-tui;c:-!echo $(pwd -P)"/$nnn"'

# context colors [default: '4444' (blue)]
export NNN_COLORS='2354'

# color theme onedark
# https://github.com/jarun/nnn/wiki/Themes
BLK="04" CHR="04" DIR="04" EXE="00" REG="00" HARDLINK="00" SYMLINK="06" MISSING="00" ORPHAN="01" FIFO="0F" SOCK="0F" OTHER="02"
export NNN_FCOLORS="$BLK$CHR$DIR$EXE$REG$HARDLINK$SYMLINK$MISSING$ORPHAN$FIFO$SOCK$OTHER"

n ()
{

    # Block nesting of nnn in subshells
    if [ -n $NNNLVL ] && [ "${NNNLVL:-0}" -ge 1 ]; then
        echo "nnn is already running"
        return
    fi

    # The default behaviour is to cd on quit (nnn checks if NNN_TMPFILE is set)
    # To cd on quit only on ^G, remove the "export" as in:
    #     NNN_TMPFILE="${XDG_CONFIG_HOME:-$HOME/.config}/nnn/.lastd"
    # NOTE: NNN_TMPFILE is fixed, should not be modified
    # export NNN_TMPFILE="${XDG_CONFIG_HOME:-$HOME/.config}/nnn/.lastd"
    NNN_TMPFILE="${XDG_CONFIG_HOME:-$HOME/.config}/nnn/.lastd"

    # Unmask ^Q (, ^V etc.) (if required, see `stty -a`) to Quit nnn
    # stty start undef
    # stty stop undef
    # stty lwrap undef
    # stty lnext undef

    nnn "$@"

    if [ -f "$NNN_TMPFILE" ]; then
            . "$NNN_TMPFILE"
            rm -f "$NNN_TMPFILE" > /dev/null
    fi
}

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# The next line updates PATH for the Google Cloud SDK.
if [ -f "$HOME/google-cloud-sdk/path.zsh.inc" ]; then . "$HOME/google-cloud-sdk/path.zsh.inc"; fi

# The next line enables shell command completion for gcloud.
if [ -f "$HOME/google-cloud-sdk/completion.zsh.inc" ]; then . "$HOME/google-cloud-sdk/completion.zsh.inc"; fi
