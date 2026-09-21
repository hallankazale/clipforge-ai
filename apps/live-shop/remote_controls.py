ALLOWED_ACTIONS = {"start", "pause", "stop", "next"}

def normalize_action(value: str) -> str:
    action=(value or "").strip().lower()
    if action not in ALLOWED_ACTIONS:
        raise ValueError("ação inválida")
    return action

def action_state(action: str) -> str:
    action=normalize_action(action)
    return {"start":"running","pause":"paused","stop":"stopped","next":"running"}[action]
