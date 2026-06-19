@echo off
chcp 65001 > nul
title Git Deploy - Switcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git_deploy.ps1"
pause
