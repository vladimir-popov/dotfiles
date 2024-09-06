zmodload zsh/zprof

# Common paths:
export PROJECTS=$HOME'/Projects'
export CONFIGS_PATH=$HOME'/.config'
export LOCAL_PATH=$HOME'/.local'
export NVIM_PATH=$CONFIGS_PATH'/nvim'
export NVIM_PLUG=$LOCAL_PATH'/share/nvim/lazy'

# or frappe, macchiato, mocha, latte
export CATPPUCCIN=latte
catppuccin() {
	if [ $# -lt 1 ]
	then
	    echo "Usage: $funcstack[1] frappe | macchiato | mocha | latte"
	    return
	fi
	export CATPPUCCIN=$1
	tmux set-environment -g CATPPUCCIN $1
	tmux source ~/.tmux.conf
	sed -i '' -E "2s/catppuccin-[a-z]+/catppuccin-$CATPPUCCIN/g" ~/.alacritty.toml
}


alias v=nvim
alias vc="v -c \"normal '0\""
alias lg=lazygit
alias scli=scala-cli

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


# ==================================================================================================
#                                         GCP configuration
# ==================================================================================================
export USE_GKE_GCLOUD_AUTH_PLUGIN=True
export KUBE_EDITOR="nvim"

if [ -x "$(command -v kubectl)" ]; then
   source <(kubectl completion zsh)
fi

# The next line updates PATH for the Google Cloud SDK.
if [ -f "$HOME/google-cloud-sdk/path.zsh.inc" ]; then . "$HOME/google-cloud-sdk/path.zsh.inc"; fi

# The next line enables shell command completion for gcloud.
if [ -f "$HOME/google-cloud-sdk/completion.zsh.inc" ]; then . "$HOME/google-cloud-sdk/completion.zsh.inc"; fi

# ==================================================================================================
#                                         FZF configuration
# ==================================================================================================
export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -f -g ""'

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# ==================================================================================================
#                                       Docker configuration
# ==================================================================================================

export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
export DOCKER_HOST="unix://${HOME}/.colima/docker.sock"

# ==================================================================================================
#                                       Arduino configuration
# ==================================================================================================

export ARDUINO_DIR="$HOME/Library/Arduino15"
if [[ -d "$ARDUINO_DIR" ]]; then

# see https://github.com/tiberiusbrown/Ardens
export ARDENS_PATH="$PROJECTS/Arduino/Ardens"

# autocompletion for arduino-cli
# see https://arduino.github.io/arduino-cli/0.33/command-line-completion
if [[ -d "$HOME/completion_zsh" ]]; then
	fpath=($HOME/completion_zsh $fpath)
fi

fi

# ==================================================================================================
#                                      Playdate configuration
# ==================================================================================================

export PLAYDATE_SDK_PATH=$HOME/Developer/PlaydateSDK

# ==================================================================================================

# ==================================================================================================
#                                         nnn configuration
# ==================================================================================================

# Bookmarks: set environment variable NNN_BMS as a string of
# key_char:location pairs separated by semicolons (;):
NNN_BMS="c:$CONFIGS_PATH;l:$LOCAL_PATH;p:$PROJECTS;v:$NVIM_PATH;V:$NVIM_PLUG;n:$PROJECTS/nvim;"
NNN_BMS+="A:$HOME/Library/Arduino15/packages/arduino/hardware/avr/1.8.6;z:$ZIG_HOME/lib/std;"

if [[ -d "$PROJECTS/dash" ]]; then
  B_DASH='d:'$PROJECTS'/dash;'
  B_DASH_WIKI='w:'$PROJECTS'/dash.wiki;'
  NNN_BMS="$NNN_BMS$B_DASH$B_DASH_WIKI"
fi

export NNN_BMS

export NNN_OPENER="$HOME/.config/nnn/plugins/nuke"

# setup FIFO for preview feature
export NNN_FIFO='/tmp/nnn.fifo'

# useful plugins:
NNN_P_PWD='-!echo $(pwd -P)"/$nnn"'
NNN_P_OPEN='-!open $(pwd -P)"/$nnn"'
NNN_P_OPEN_IN_NVIM='-!nvim $(pwd -P)"/$nnn"'
NNN_P_ARD='-!'$ARDENS_PATH'/Ardens file=$(pwd -P)"/$nnn"'
export NNN_PLUG="f:fzcd;n:nuke;d:diffs;i:batview;v:$NNN_P_OPEN_IN_NVIM;p:preview-tui;c:$NNN_P_PWD;a:$NNN_P_ARD;o:$NNN_P_OPEN;"

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

    nnn -A "$@"

    if [ -f "$NNN_TMPFILE" ]; then
            . "$NNN_TMPFILE"
            rm -f "$NNN_TMPFILE" > /dev/null
    fi
}
# ==================================================================================================

export SBT_OPTS="-Xmx12G -XX:+UseG1GC"

path=(
	$path
	"$HOME/.pyenv/bin"
	"$HOME/.local/bin"
	"$HOME/go/bin"
	"$HOME/.yarn/bin"
	"$HOME/.config/yarn/global/node_modules/.bin"
	"$HOME/.cargo/bin"
	"$ARDENS_PATH"
	"$PLAYDATE_SDK_PATH/bin"
	"$HOME/.zvm/self"
	"$HOME/.zvm/bin"
)
export PATH
