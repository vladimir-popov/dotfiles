# bindkey -l    --- to list all variants
# bindkey -M    --- to read key binds in specified scheme
#bindkey -v 

# file with aliases
. ~/.aliases

# allow v to edit the command line (standard behaviour)
#autoload -Uz edit-command-line
#zle -N edit-command-line
bindkey '^v' edit-command-line

# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="/Users/vladimir/.oh-my-zsh"

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

test -e "${HOME}/.iterm2_shell_integration.zsh" && source "${HOME}/.iterm2_shell_integration.zsh"


# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/vladimir/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/vladimir/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/Users/vladimir/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/vladimir/google-cloud-sdk/completion.zsh.inc'; fi

export KUBE_EDITOR="nvim"
alias gcli='docker run -v /Users/vladimir:/defs --rm -it namely/grpc-cli'


[[ /usr/local/bin/kubectl ]] && source <(kubectl completion zsh)

export PATH="$HOME/.pyenv/bin:$HOME/go/bin:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"
export SBT_OPTS="-Xmx8G -XX:+UseG1GC"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"

export FZF_DEFAULT_COMMAND='ag --hidden --ignore .git -f -g ""'

# ==============================================================================
#                               nnn configuration
# ==============================================================================

# Bookmarks: set environment variable NNN_BMS as a string of
# key_char:location pairs separated by semicolons (;):
export GDISK='/Volumes/GoogleDrive/My Drive'
export PROJECTS=$HOME'/Projects'
export VIM_PATH=$HOME'/.vim'
export NVIM_PATH=$HOME'/.local/share/nvim'

B_HOME='h:'$HOME';'
B_PROJECTS='p:'$PROJECTS';'
B_DASH='d:'$PROJECTS'/dash;'
B_DASH_WIKI='w:'$PROJECTS'/dash.wiki;'
B_GDISK='G:'$GDISK';'
B_SETTINGS='S:'$GDISK'/Settings;'
B_VIM='v:'$VIM_PATH'/plugged;'
B_NVIM='V:'$NVIM_PATH';'

export NNN_BMS=$B_HOME$B_PROJECTS$B_DASH$B_DASH_WIKI$B_VIM$B_NVIM$B_GDISK$B_SETTINGS

export NNN_OPENER=~/.config/nnn/plugins/nuke

# setup FIFO for preview feature
export NNN_FIFO='/tmp/nnn.fifo'

# useful plugins:
export NNN_PLUG='f:fzopen;n:nuke;d:diffs;i:batview;v:imgview'


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

alias luamake=/Users/vladimir/Projects/lua-language-server/3rd/luamake/luamake
