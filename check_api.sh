#!/bin/bash
curl -s http://localhost:3000/users/leaderboard?type=SCHOOL | json_pp
