# engines/ — Inference engine binaries
# These are NOT stored in git (too large, 50-200 MB each).
# They are downloaded at build time or bundled manually.
#
# Expected structure:
#   engines/llama/binaries/cpu/llama-server.exe
#   engines/llama/binaries/cuda/llama-server.exe
#   engines/whisper/binaries/cpu/whisper.exe
#   engines/whisper/models/ggml-tiny.bin (75 MB, bundled)
#
# For the first test build: this directory can be empty.
# The app will build and launch but inference won't work until
# engine binaries are placed here.
