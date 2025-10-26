"""
Production-Ready Natural Language Query System for AWS Lambda
- Azure OpenAI (GPT-4o) Integration - TEXT UNDERSTANDING ONLY
- ALL calculations done in Python (dates, numbers, ranges)
- Comprehensive Query Coverage
- Returns JSON with raw data + chart config
- Optimized for Performance
- ENHANCED with additional query patterns and natural language support
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
import os
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from openai import AzureOpenAI

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT', 'https://aiage-mh4lk8m5-eastus2.cognitiveservices.azure.com/')
AZURE_OPENAI_KEY = os.environ.get('AZURE_OPENAI_KEY', '1jSEw3gXJYnZWcSsb5WKEg2kdNPJaOchCp64BgVzEUkgbsPJ5Y5KJQQJ99BJACHYHv6XJ3w3AAAAACOGx3MU')
AZURE_OPENAI_API_VERSION = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-12-01-preview')
AZURE_OPENAI_DEPLOYMENT = os.environ.get('AZURE_OPENAI_DEPLOYMENT', 'gpt-4o')

# Database Configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'aws-1-us-east-1.pooler.supabase.com'),
    'port': int(os.environ.get('DB_PORT', 6543)),
    'database': os.environ.get('DB_NAME', 'postgres'),
    'user': os.environ.get('DB_USER', 'postgres.jlhkysdsahtnygjawwvt'),
    'password': os.environ.get('DB_PASSWORD', 'Vyaasai@rmone'),
    'sslmode': 'disable',
    'connect_timeout': 10
}

# Enable/Disable Debug Mode
DEBUG_MODE = os.environ.get('DEBUG_MODE', 'true').lower() == 'true'

class SemanticTimeParser:
    """
    Intelligent time parser that understands natural language time expressions
    without relying on rigid regex patterns
    """
    
    def __init__(self):
        self.today = datetime.now()
    
    def parse(self, time_reference: str) -> Optional[Tuple[str, str]]:
        """
        Parse ANY natural language time reference
        
        Args:
            time_reference: User's original time phrase
            
        Returns:
            Tuple of (start_date, end_date) in YYYY-MM-DD format, or None
        """
        if not time_reference:
            return None
        
        time_ref = time_reference.lower().strip()
        
        # ═══════════════════════════════════════════════════════════════
        # CATEGORY 1: RELATIVE TIME PERIODS (flexible patterns)
        # ═══════════════════════════════════════════════════════════════
        
        # Future time references
        if any(word in time_ref for word in ['next', 'coming', 'upcoming', 'future']):
            return self._parse_future_reference(time_ref)
        
        # Past time references
        if any(word in time_ref for word in ['last', 'past', 'previous', 'recent']):
            return self._parse_past_reference(time_ref)
        
        # ═══════════════════════════════════════════════════════════════
        # CATEGORY 2: VAGUE TIME REFERENCES
        # ═══════════════════════════════════════════════════════════════
        
        vague_mappings = {
            'soon': (0, 90),           # Next 3 months
            'near future': (0, 180),   # Next 6 months
            'short term': (0, 180),    # Next 6 months
            'medium term': (180, 730), # 6 months to 2 years
            'long term': (730, 1825),  # 2 to 5 years
            'immediately': (0, 30),    # Next month
            'recently': (-90, 0),      # Last 3 months
            'shortly': (0, 60),        # Next 2 months
            'little while': (0, 90),   # Next 3 months
        }
        
        for phrase, (start_days, end_days) in vague_mappings.items():
            if phrase in time_ref:
                start_date = (self.today + timedelta(days=start_days)).strftime('%Y-%m-%d')
                end_date = (self.today + timedelta(days=end_days)).strftime('%Y-%m-%d')
                
                if DEBUG_MODE:
                    print(f"✅ Matched vague term '{phrase}' → {start_days} to {end_days} days")
                
                return (start_date, end_date)
        
        # ═══════════════════════════════════════════════════════════════
        # CATEGORY 3: SPECIFIC TIME PERIODS
        # ═══════════════════════════════════════════════════════════════
        
        # This quarter
        if 'this quarter' in time_ref:
            return self._get_current_quarter_dates()
        
        # This year
        if 'this year' in time_ref:
            return (f"{self.today.year}-01-01", f"{self.today.year}-12-31")
        
        # Specific quarter (Q1 2026, first quarter 2026)
        quarter_result = self._parse_specific_quarter(time_ref)
        if quarter_result:
            return quarter_result
        
        # Specific year (2026, in 2026)
        year_result = self._parse_specific_year(time_ref)
        if year_result:
            return year_result
        
        # Month range (between January and March 2026)
        month_range = self._parse_month_range(time_ref)
        if month_range:
            return month_range
        
        # ═══════════════════════════════════════════════════════════════
        # CATEGORY 4: NUMERIC + UNIT PATTERNS (flexible extraction)
        # ═══════════════════════════════════════════════════════════════
        
        # Extract any number + time unit combination
        numeric_result = self._extract_numeric_timeframe(time_ref)
        if numeric_result:
            return numeric_result
        
        return None
    
    def _parse_future_reference(self, text: str) -> Optional[Tuple[str, str]]:
        """Parse future time references with flexible patterns"""
        
        # Extract numeric timeframe if present
        result = self._extract_numeric_timeframe(text)
        if result:
            return result
        
        # Default future ranges if no specific timeframe found
        future_defaults = {
            'quarter': 90,
            'year': 365,
            'months': 180,  # Default to 6 months if unspecified
        }
        
        for unit, days in future_defaults.items():
            if unit in text:
                start_date = self.today.strftime('%Y-%m-%d')
                end_date = (self.today + timedelta(days=days)).strftime('%Y-%m-%d')
                
                if DEBUG_MODE:
                    print(f"✅ Matched future default '{unit}' → {days} days")
                
                return (start_date, end_date)
        
        # Generic "next/coming/upcoming" without specific unit → default 6 months
        if DEBUG_MODE:
            print(f"✅ Generic future reference → default 6 months")
        
        start_date = self.today.strftime('%Y-%m-%d')
        end_date = (self.today + timedelta(days=180)).strftime('%Y-%m-%d')
        return (start_date, end_date)
    
    def _parse_past_reference(self, text: str) -> Optional[Tuple[str, str]]:
        """Parse past time references with flexible patterns"""
        
        # Extract numeric timeframe if present
        result = self._extract_numeric_timeframe(text)
        if result:
            return result
        
        # Default past ranges if no specific timeframe found
        past_defaults = {
            'quarter': 90,
            'year': 365,
            'months': 180,  # Default to 6 months if unspecified
        }
        
        for unit, days in past_defaults.items():
            if unit in text:
                start_date = (self.today - timedelta(days=days)).strftime('%Y-%m-%d')
                end_date = self.today.strftime('%Y-%m-%d')
                
                if DEBUG_MODE:
                    print(f"✅ Matched past default '{unit}' → {days} days")
                
                return (start_date, end_date)
        
        # Generic "last/past" without specific unit → default 6 months
        if DEBUG_MODE:
            print(f"✅ Generic past reference → default 6 months")
        
        start_date = (self.today - timedelta(days=180)).strftime('%Y-%m-%d')
        end_date = self.today.strftime('%Y-%m-%d')
        return (start_date, end_date)
    
    def _extract_numeric_timeframe(self, text: str) -> Optional[Tuple[str, str]]:
        """
        Extract numeric timeframes with flexible matching
        Handles: "10 months", "ten months", "5 years", "five years", etc.
        """
        
        # Convert written numbers to digits
        text = self._convert_written_numbers(text)
        
        # Pattern: any digit + time unit
        pattern = r'(\d+)\s*(month|months|day|days|year|years|week|weeks|quarter|quarters)'
        match = re.search(pattern, text)
        
        if match:
            quantity = int(match.group(1))
            unit = match.group(2).rstrip('s')  # Remove plural
            
            days = self._unit_to_days(quantity, unit)
            
            # Determine if future or past based on context
            is_future = any(word in text for word in ['next', 'coming', 'upcoming', 'future'])
            is_past = any(word in text for word in ['last', 'past', 'previous', 'recent'])
            
            if is_future:
                start_date = self.today.strftime('%Y-%m-%d')
                end_date = (self.today + timedelta(days=days)).strftime('%Y-%m-%d')
            elif is_past:
                start_date = (self.today - timedelta(days=days)).strftime('%Y-%m-%d')
                end_date = self.today.strftime('%Y-%m-%d')
            else:
                # Default to future if ambiguous
                start_date = self.today.strftime('%Y-%m-%d')
                end_date = (self.today + timedelta(days=days)).strftime('%Y-%m-%d')
            
            if DEBUG_MODE:
                print(f"✅ Extracted numeric timeframe: {quantity} {unit} → {days} days ({'future' if is_future else 'past' if is_past else 'default future'})")
            
            return (start_date, end_date)
        
        return None
    
    def _convert_written_numbers(self, text: str) -> str:
        """Convert written numbers to digits"""
        word_to_number = {
            'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
            'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
            'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 
            'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 
            'nineteen': '19', 'twenty': '20', 'thirty': '30', 'forty': '40', 
            'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90'
        }
        
        for word, number in word_to_number.items():
            text = re.sub(rf'\b{word}\b', number, text, flags=re.IGNORECASE)
        
        return text
    
    def _unit_to_days(self, quantity: int, unit: str) -> int:
        """Convert time unit to days"""
        unit = unit.lower()
        if unit == 'day':
            return quantity
        elif unit == 'week':
            return quantity * 7
        elif unit == 'month':
            return quantity * 30
        elif unit == 'quarter':
            return quantity * 90
        elif unit == 'year':
            return quantity * 365
        return 0
    
    def _get_current_quarter_dates(self) -> Tuple[str, str]:
        """Get start and end dates of current quarter"""
        month = self.today.month
        year = self.today.year
        
        if month <= 3:
            return (f"{year}-01-01", f"{year}-03-31")
        elif month <= 6:
            return (f"{year}-04-01", f"{year}-06-30")
        elif month <= 9:
            return (f"{year}-07-01", f"{year}-09-30")
        else:
            return (f"{year}-10-01", f"{year}-12-31")
    
    def _parse_specific_quarter(self, text: str) -> Optional[Tuple[str, str]]:
        """Parse Q1 2026, first quarter 2026, etc."""
        # Q1, Q2, Q3, Q4 pattern
        match = re.search(r'q(\d)\s+(\d{4})', text)
        if match:
            quarter = int(match.group(1))
            year = int(match.group(2))
            return self._get_quarter_dates(year, quarter)
        
        # First/second/third/fourth quarter pattern
        quarter_names = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4}
        for name, num in quarter_names.items():
            pattern = rf'{name}\s+quarter\s+(\d{{4}})'
            match = re.search(pattern, text)
            if match:
                year = int(match.group(1))
                return self._get_quarter_dates(year, num)
        
        return None
    
    def _get_quarter_dates(self, year: int, quarter: int) -> Tuple[str, str]:
        """Get start and end dates for a specific quarter"""
        quarters = {
            1: (f"{year}-01-01", f"{year}-03-31"),
            2: (f"{year}-04-01", f"{year}-06-30"),
            3: (f"{year}-07-01", f"{year}-09-30"),
            4: (f"{year}-10-01", f"{year}-12-31")
        }
        return quarters.get(quarter, (f"{year}-01-01", f"{year}-12-31"))
    
    def _parse_specific_year(self, text: str) -> Optional[Tuple[str, str]]:
        """Parse year references: 2026, in 2026, during 2026"""
        match = re.search(r'\b(20\d{2})\b', text)
        if match:
            year = int(match.group(1))
            return (f"{year}-01-01", f"{year}-12-31")
        return None
    
    def _parse_month_range(self, text: str) -> Optional[Tuple[str, str]]:
        """Parse 'between January and March 2026'"""
        month_map = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
            'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
            'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
            'november': 11, 'nov': 11, 'december': 12, 'dec': 12
        }
        
        pattern = r'between\s+(\w+)\s+and\s+(\w+)\s+(\d{4})'
        match = re.search(pattern, text)
        
        if match:
            start_month = month_map.get(match.group(1))
            end_month = month_map.get(match.group(2))
            year = int(match.group(3))
            
            if start_month and end_month:
                start_date = f"{year}-{start_month:02d}-01"
                
                if end_month == 12:
                    end_date = f"{year}-12-31"
                else:
                    next_month = datetime(year, end_month + 1, 1)
                    last_day = (next_month - timedelta(days=1)).day
                    end_date = f"{year}-{end_month:02d}-{last_day}"
                
                return (start_date, end_date)
        
        return None


class DateCalculator:
    """Handle all date-related calculations - NO LLM INVOLVED"""
    
    @staticmethod
    def parse_relative_date(text: str) -> Optional[Tuple[str, str]]:
        """
        Parse relative date expressions and return (start_date, end_date)
        
        Supported patterns:
        - "last 6 months", "past 6 months", "previous 6 months"
        - "next 6 months", "future 6 months", "upcoming 6 months"
        - "last 45 days", "next 30 days"
        - "last 2 years", "next 1 year"
        - "last 6 months or next 6 months"
        - "in the last 6 months", "in the next 3 months"
        
        Returns:
            Tuple of (start_date, end_date) in YYYY-MM-DD format, or None
        """
        text = text.lower().strip()
        today = datetime.now()
        
        # Pattern 1: "last/past/previous N months/days/years/weeks"
        past_patterns = [
            r'(?:last|past|previous)\s+(\d+)\s+(month|months|day|days|year|years|week|weeks)',
            r'in\s+the\s+(?:last|past|previous)\s+(\d+)\s+(month|months|day|days|year|years|week|weeks)',
        ]
        
        for pattern in past_patterns:
            match = re.search(pattern, text)
            if match:
                quantity = int(match.group(1))
                unit = match.group(2).rstrip('s')  # Remove plural 's'
                
                days = DateCalculator._unit_to_days(quantity, unit)
                start_date = (today - timedelta(days=days)).strftime('%Y-%m-%d')
                end_date = today.strftime('%Y-%m-%d')
                
                return (start_date, end_date)
        
        # Pattern 2: "next/future/upcoming N months/days/years/weeks"
        future_patterns = [
            r'(?:next|future|upcoming|coming)\s+(\d+)\s+(month|months|day|days|year|years|week|weeks)',
            r'in\s+the\s+(?:next|future|upcoming|coming)\s+(\d+)\s+(month|months|day|days|year|years|week|weeks)',
        ]
        
        for pattern in future_patterns:
            match = re.search(pattern, text)
            if match:
                quantity = int(match.group(1))
                unit = match.group(2).rstrip('s')
                
                days = DateCalculator._unit_to_days(quantity, unit)
                start_date = today.strftime('%Y-%m-%d')
                end_date = (today + timedelta(days=days)).strftime('%Y-%m-%d')
                
                return (start_date, end_date)
        
        # Pattern 3: "last N months OR/AND next N months" (combined range)
        or_pattern = r'(?:last|past)\s+(\d+)\s+(month|months|day|days|year|years|week|weeks)\s+(?:or|and)\s+(?:next|future)\s+(\d+)\s+(month|months|day|days|year|years|week|weeks)'
        match = re.search(or_pattern, text)
        if match:
            past_qty = int(match.group(1))
            past_unit = match.group(2).rstrip('s')
            future_qty = int(match.group(3))
            future_unit = match.group(4).rstrip('s')
            
            past_days = DateCalculator._unit_to_days(past_qty, past_unit)
            future_days = DateCalculator._unit_to_days(future_qty, future_unit)
            
            start_date = (today - timedelta(days=past_days)).strftime('%Y-%m-%d')
            end_date = (today + timedelta(days=future_days)).strftime('%Y-%m-%d')
            
            return (start_date, end_date)
        
        return None
    
    @staticmethod
    def _unit_to_days(quantity: int, unit: str) -> int:
        """Convert time unit to days"""
        unit = unit.lower()
        if unit == 'day':
            return quantity
        elif unit == 'week':
            return quantity * 7
        elif unit == 'month':
            return quantity * 30  # Approximate
        elif unit == 'year':
            return quantity * 365
        return 0

    @staticmethod
    def _parse_multiple_items(text: str) -> List[str]:
        """
        Parse multiple items separated by 'and', '&', commas
        
        Examples:
        - "Rail and Transit" → ["Rail", "Transit"]
        - "Transportation, Infrastructure, Rail" → ["Transportation", "Infrastructure", "Rail"]
        - "Rail & Transit & Infrastructure" → ["Rail", "Transit", "Infrastructure"]
        
        Returns:
            List of parsed items (up to 5)
        """
        # Replace separators with commas
        text = text.replace(' and ', ',')
        text = text.replace(' & ', ',')
        text = text.replace('&', ',')
        
        # Split by comma and clean
        items = [item.strip() for item in text.split(',') if item.strip()]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_items = []
        for item in items:
            if item.lower() not in seen:
                seen.add(item.lower())
                unique_items.append(item)
        
        # Limit to 5 items
        return unique_items[:5]



    
    @staticmethod
    def parse_specific_quarter(text: str) -> Optional[Tuple[int, int]]:
        """
        Parse quarter expressions like "Q1 2026", "first quarter 2026"
        
        Returns:
            Tuple of (year, quarter), or None
        """
        text = text.lower()
        
        # Pattern: "Q1 2026", "q1 2026"
        match = re.search(r'q(\d)\s+(\d{4})', text)
        if match:
            quarter = int(match.group(1))
            year = int(match.group(2))
            if 1 <= quarter <= 4:
                return (year, quarter)
        
        # Pattern: "first quarter 2026", "second quarter 2026"
        quarter_names = {
            'first': 1, '1st': 1,
            'second': 2, '2nd': 2,
            'third': 3, '3rd': 3,
            'fourth': 4, '4th': 4
        }
        
        for name, num in quarter_names.items():
            pattern = rf'{name}\s+quarter\s+(\d{{4}})'
            match = re.search(pattern, text)
            if match:
                year = int(match.group(1))
                return (year, num)
        
        return None
    
    @staticmethod
    def parse_specific_year(text: str) -> Optional[int]:
        """
        Parse year expressions like "projects in 2026"
        
        Returns:
            Year as integer, or None
        """
        # Pattern: "in 2026", "during 2026", "for 2026"
        match = re.search(r'(?:in|during|for)\s+(20\d{2})', text.lower())
        if match:
            return int(match.group(1))
        
        # Pattern: standalone year "2026"
        match = re.search(r'\b(20\d{2})\b', text)
        if match:
            return int(match.group(1))
        
        return None
    
    @staticmethod
    def parse_multiple_years(text: str) -> Optional[List[int]]:
        """
        Parse multiple year expressions like "2026 and 2027", "2025, 2026, 2027"
        
        Returns:
            List of years, or None
        """
        # Pattern: "2026 and 2027", "2025, 2026 and 2027"
        years = re.findall(r'\b(20\d{2})\b', text)
        if len(years) > 1:
            return [int(y) for y in years]
        
        return None
    
    @staticmethod
    def parse_month_range(text: str) -> Optional[Tuple[str, str]]:
        """
        Parse 'between January and March 2026' patterns
        
        Returns:
            Tuple of (start_date, end_date) in YYYY-MM-DD format, or None
        """
        month_map = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
            'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
            'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
            'august': 8, 'aug': 8, 'september': 9, 'sep': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
            'december': 12, 'dec': 12
        }
        
        # Pattern: "between MONTH and MONTH YEAR"
        pattern = r'between\s+(\w+)\s+and\s+(\w+)\s+(\d{4})'
        match = re.search(pattern, text.lower())
        
        if match:
            start_month = month_map.get(match.group(1))
            end_month = month_map.get(match.group(2))
            year = int(match.group(3))
            
            if start_month and end_month:
                start_date = f"{year}-{start_month:02d}-01"
                
                # Last day of end month
                if end_month == 12:
                    end_date = f"{year}-12-31"
                else:
                    next_month = datetime(year, end_month + 1, 1)
                    last_day = (next_month - timedelta(days=1)).day
                    end_date = f"{year}-{end_month:02d}-{last_day}"
                
                return (start_date, end_date)
        
        return None


class NumberCalculator:
    """Handle all number/fee-related calculations - NO LLM INVOLVED"""
    
    @staticmethod
    def parse_fee_amount(text: str) -> Optional[float]:
        """
        Parse fee amounts with various formats:
        - "5 million" → 5000000
        - "10M" → 10000000
        - "2.5 billion" → 2500000000
        - "500k" → 500000
        - "1,000,000" → 1000000
        
        Returns:
            Fee as float, or None
        """
        text = text.lower().replace(',', '')
        
        # Pattern: "5 million", "5million", "5m"
        match = re.search(r'(\d+\.?\d*)\s*(?:million|m)(?:\s|$)', text)
        if match:
            return float(match.group(1)) * 1000000
        
        # Pattern: "2 billion", "2billion", "2b"
        match = re.search(r'(\d+\.?\d*)\s*(?:billion|b)(?:\s|$)', text)
        if match:
            return float(match.group(1)) * 1000000000
        
        # Pattern: "500 thousand", "500k"
        match = re.search(r'(\d+\.?\d*)\s*(?:thousand|k)(?:\s|$)', text)
        if match:
            return float(match.group(1)) * 1000
        
        # Pattern: plain number "1000000"
        match = re.search(r'\b(\d+\.?\d*)\b', text)
        if match:
            return float(match.group(1))
        
        return None
    
    @staticmethod
    def parse_fee_range(text: str) -> Optional[Tuple[float, Optional[float]]]:
        """
        Parse fee range expressions:
        - "over 5 million" → (5000000, None)
        - "above 10M" → (10000000, None)
        - "between 10 and 50 million" → (10000000, 50000000)
        - "10 to 15 million" → (10000000, 15000000)
        - "under 5 million" → (0, 5000000)
        
        Returns:
            Tuple of (min_fee, max_fee), or None
        """
        text = text.lower()
        
        # Pattern: "between X and Y million"
        match = re.search(r'between\s+(\d+\.?\d*)\s+and\s+(\d+\.?\d*)\s+(million|billion|thousand|m|b|k)', text)
        if match:
            min_val = float(match.group(1))
            max_val = float(match.group(2))
            multiplier = NumberCalculator._get_multiplier(match.group(3))
            return (min_val * multiplier, max_val * multiplier)
        
        # Pattern: "X to Y million"
        match = re.search(r'(\d+\.?\d*)\s+to\s+(\d+\.?\d*)\s+(million|billion|thousand|m|b|k)', text)
        if match:
            min_val = float(match.group(1))
            max_val = float(match.group(2))
            multiplier = NumberCalculator._get_multiplier(match.group(3))
            return (min_val * multiplier, max_val * multiplier)
        
        # Pattern: "over/above/more than X million"
        match = re.search(r'(?:over|above|more than|greater than)\s+(\d+\.?\d*)\s*(million|billion|thousand|m|b|k)?', text)
        if match:
            val = float(match.group(1))
            multiplier = NumberCalculator._get_multiplier(match.group(2) or '')
            return (val * multiplier, None)
        
        # Pattern: "under/below/less than X million"
        match = re.search(r'(?:under|below|less than)\s+(\d+\.?\d*)\s*(million|billion|thousand|m|b|k)?', text)
        if match:
            val = float(match.group(1))
            multiplier = NumberCalculator._get_multiplier(match.group(2) or '')
            return (0, val * multiplier)
        
        return None
    
    @staticmethod
    def _get_multiplier(unit: str) -> float:
        """Get numeric multiplier for unit"""
        unit = unit.lower().strip()
        if unit in ['million', 'm']:
            return 1000000
        elif unit in ['billion', 'b']:
            return 1000000000
        elif unit in ['thousand', 'k']:
            return 1000
        return 1
    
    @staticmethod
    def parse_limit(text: str) -> Optional[int]:
        """
        Parse limit expressions:
        - "top 10" → 10
        - "first 5" → 5
        - "largest 20" → 20
        
        Returns:
            Limit as integer, or None
        """
        # Pattern: "top/first/largest N"
        match = re.search(r'(?:top|first|largest|biggest|smallest)\s+(\d+)', text.lower())
        if match:
            return int(match.group(1))
        
        return None


class AzureOpenAIClient:
    """Azure OpenAI GPT-4o client - TEXT UNDERSTANDING ONLY, NO CALCULATIONS"""
    
    def __init__(self):
        """Initialize Azure OpenAI client"""
        self.client = AzureOpenAI(
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_KEY
        )
        self.deployment = AZURE_OPENAI_DEPLOYMENT
    
    def _build_functions_text(self, functions: List[Dict]) -> str:
        """Build formatted function definitions text"""
        functions_text = "AVAILABLE FUNCTIONS:\n"
        functions_text += "═══════════════════════════════════════════════════════════════\n\n"
        
        for func in functions:
            functions_text += f"Function: {func['name']}\n"
            functions_text += f"Description: {func['description']}\n"
            functions_text += f"Parameters: {json.dumps(func['parameters'], indent=2)}\n\n"
        
        return functions_text
    
    def _get_database_schema(self) -> str:
        """Return database schema documentation"""
        return """
DATABASE SCHEMA:
═══════════════════════════════════════════════════════════════
Table: "Sample"

Key Columns:
- Request Category (text)    : Market segment (Healthcare, Education, Transportation, etc.)
- Project Name (integer)      : Unique project identifier (e.g., PID 1, PID 2)
- Client (text)               : Client name (e.g., CLID 5728, TAMU, etc.)
- Status (text)               : Project status (Lead, Won, Submitted, Lost, Proposal Development, etc.)
- Fee (numeric)               : Project fee in dollars
- Company (text)              : Operating company (Company A, Company B, Company C, etc.)
- Point Of Contact (text)     : Primary contact person name
- Win % (integer)             : Win probability percentage (0-100)
- Project Type (text)         : Type classification (Hospitals, Higher Education, etc.)
- Start Date (date)           : Project start date
- State Lookup (text)         : State/region code (stored as text, e.g., "0", "1831")
- Tags (text)                 : Comma-separated tags
- Description (text)          : Project description
"""
    
    def _get_query_examples(self) -> str:
        """Return comprehensive query examples"""
        return """
COMPREHENSIVE QUERY EXAMPLES:
═══════════════════════════════════════════════════════════════

IMPORTANT: Your job is to identify USER INTENT only. 
DO NOT calculate dates, numbers, or perform any math.
The system will handle all calculations automatically.

DATE-BASED QUERIES (just identify the pattern):
───────────────────────────────────────────────────────────────
- "projects in last 6 months" → Mention: time_reference
- "next 6 months" → Mention: time_reference
- "last 3 months" → Mention: time_reference
- "projects in 2026" → Use: get_projects_by_year
- "Q1 2026" → Use: get_projects_by_quarter
- "2026 and 2027" → Use: get_projects_by_years
- "between January and March 2026" → Mention: time_reference

RANKING QUERIES:
───────────────────────────────────────────────────────────────
- "top 10 projects" → get_largest_projects
- "largest projects" → get_largest_projects
- "smallest projects" → get_smallest_projects
- "top 5 in healthcare" → get_largest_by_category

REGION/STATE QUERIES:
───────────────────────────────────────────────────────────────
- "projects in state 1831" → get_projects_by_state
- "largest in state 0" → get_largest_in_region
- "California projects" → get_projects_by_state

CATEGORY/TYPE QUERIES:
───────────────────────────────────────────────────────────────
- "healthcare projects" → get_projects_by_category
- "transportation projects" → get_projects_by_category
- "healthcare and transportation" → get_projects_by_multiple_categories

COMPANY QUERIES:
───────────────────────────────────────────────────────────────
- "Company G projects" → get_projects_by_company
- "compare all companies" → compare_companies
- "Company G vs Company O revenue" → compare_opco_revenue

CLIENT QUERIES:
───────────────────────────────────────────────────────────────
- "all projects for TAMU" → get_projects_by_client
- "TAMU projects" → get_projects_by_client
- "TAMU projects between 10 and 50 million" → get_projects_by_client_and_fee_range

STATUS QUERIES:
───────────────────────────────────────────────────────────────
- "won projects" → get_projects_by_status
- "lost projects" → get_projects_by_status
- "submitted projects" → get_projects_by_status
- "top 5 predicted to win" → get_top_predicted_wins

FEE/SIZE QUERIES:
───────────────────────────────────────────────────────────────
- "projects over 5 million" → get_projects_by_fee_range
- "between 10 and 50 million" → get_projects_by_fee_range
- "medium sized projects" → get_projects_by_size
- "size distribution" → get_size_distribution

TAG QUERIES:
───────────────────────────────────────────────────────────────
- "projects with healthcare tags" → get_projects_by_tags
- "largest projects with healthcare tags" → get_largest_by_tags
- "most used tags" → get_top_tags
- "top 10 tags in 2026-27" → get_top_tags_by_date
- "projects with same tags as TAMU" → get_projects_by_shared_tags

REVENUE/VALUE QUERIES:
───────────────────────────────────────────────────────────────
- "total revenue in healthcare" → get_revenue_by_category
- "how much money in submitted projects" → get_revenue_by_category
- "predicted revenue if we win all" → get_weighted_revenue_projection

YEAR COMPARISON:
───────────────────────────────────────────────────────────────
- "compare 2025 vs 2026" → compare_years
- "year over year growth" → compare_years

SIMILAR PROJECTS:
───────────────────────────────────────────────────────────────
- "similar projects to PID 1" → get_similar_projects
- "projects like PID 1" → get_similar_projects
- "related projects" → get_related_projects

OTHER QUERIES:
───────────────────────────────────────────────────────────────
- "pursuit duration analysis" → analyze_pursuit_duration
- "all projects" → get_all_projects
- "sort by win percentage" → get_projects_sorted
- "group by type and size" → group_projects_by_type_size
"""
    
    def _build_system_prompt(self, functions: List[Dict]) -> str:
        """Build complete system prompt"""
        prompt = f"""You are an INTELLIGENT SQL query classifier for a project pursuit database.

{self._build_functions_text(functions)}

{self._get_database_schema()}

{self._get_query_examples()}

═══════════════════════════════════════════════════════════════
YOUR ROLE: TEXT UNDERSTANDING ONLY
═══════════════════════════════════════════════════════════════

You are a TEXT CLASSIFIER, not a calculator.

YOUR JOB:
1. Identify what the user is asking for (intent)
2. Choose the correct function name
3. Extract key terms (client names, company names, categories, tags, etc.)

DO NOT:
❌ Calculate dates (e.g., "6 months ago" → specific dates)
❌ Calculate numbers (e.g., "5 million" → 5000000)
❌ Perform any math or conversions

The system will handle ALL calculations automatically.

IMPORTANT TAG vs CATEGORY DISTINCTION:
- If user says "healthcare tags" → Extract: tag = "healthcare"
- If user says "healthcare category" → Extract: category = "healthcare"
- If user says "healthcare projects" (ambiguous) → Default to category
- Look for keywords: "tag", "tags", "tagged", "tagged as", "tagged with"

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

Respond with ONLY a JSON object:
{{
    "function_name": "the_function_to_call",
    "arguments": {{
        "param1": "value1",
        "param2": "value2"
    }}
}}

EXAMPLES:

User: "largest projects in last 6 months"
Response: {{"function_name": "get_largest_projects", "arguments": {{}}}}

User: "top 10 projects over 5 million"
Response: {{"function_name": "get_largest_projects", "arguments": {{}}}}

User: "Company G projects"
Response: {{"function_name": "get_projects_by_company", "arguments": {{"company": "Company G"}}}}

User: "healthcare projects"
Response: {{"function_name": "get_projects_by_category", "arguments": {{"category": "healthcare"}}}}

User: "largest healthcare tags"
Response: {{"function_name": "get_largest_by_tags", "arguments": {{"tag": "healthcare"}}}}

User: "projects in 2026"
Response: {{"function_name": "get_projects_by_year", "arguments": {{"year": 2026}}}}

User: "Company A vs Company B predicted revenue"
Response: {{"function_name": "compare_opco_revenue", "arguments": {{"companies": ["Company A", "Company B"]}}}}

User: "total revenue in healthcare"
Response: {{"function_name": "get_revenue_by_category", "arguments": {{"category": "healthcare"}}}}

User: "compare 2025 vs 2026"
Response: {{"function_name": "compare_years", "arguments": {{"year1": 2025, "year2": 2026}}}}

═══════════════════════════════════════════════════════════════
RULES
═══════════════════════════════════════════════════════════════
1. Return ONLY valid JSON (no explanations, no markdown)
2. Use exact function names from the list
3. Extract text values only (names, categories, tags, status)
4. For numbers/dates: let the system calculate
5. If cannot match: return {{"function_name": "none", "arguments": {{}}}}

REMEMBER: You classify intent. The system calculates values.
"""
        return prompt
    
    def classify_query(self, user_question: str, functions: List[Dict]) -> Dict:
        """Classify user query using Azure OpenAI GPT-4o"""
        
        system_prompt = self._build_system_prompt(functions)
        
      
        try:
            response = self.client.chat.completions.create(
                model=self.deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_question}
                ],
                temperature=0.2,
                max_tokens=500
            )
            
            response_text = response.choices[0].message.content.strip()
            
            if DEBUG_MODE:
                print(f"\n🤖 GPT-4o Raw Response:\n{response_text}\n")
            
            # Extract JSON from response
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                response_text = response_text[json_start:json_end].strip()
            elif '```' in response_text:
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                response_text = response_text[json_start:json_end].strip()
            
            # Find JSON object
            if '{' in response_text and '}' in response_text:
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                response_text = response_text[json_start:json_end]
            
            result = json.loads(response_text)
            
            return {
                "function_name": result.get("function_name"),
                "arguments": result.get("arguments", {})
            }
        
        except json.JSONDecodeError as e:
            return {
                "function_name": "none", 
                "arguments": {}, 
                "error": f"JSON parse error: {str(e)}"
            }
        except Exception as e:
            return {
                "function_name": "none", 
                "arguments": {}, 
                "error": str(e)
            }

class ProjectSizeCalculator:
    """Calculate dynamic project size categories based on actual fee distribution"""
    
    def __init__(self):
        self.percentiles = None
        self.last_calculated = None
        self.cache_duration = timedelta(hours=24)
    
    def calculate_percentiles(self, force_refresh=False) -> dict:
        """
        Calculate percentile-based size categories from actual fee data
        
        Returns percentiles: p20, p40, p60, p80 for categorization
        """
        if not force_refresh and self.percentiles and self.last_calculated:
            if datetime.now() - self.last_calculated < self.cache_duration:
                if DEBUG_MODE:
                    print("🔍 Using cached percentiles")
                return self.percentiles
        
        if DEBUG_MODE:
            print("🔍 Calculating fresh percentiles from database...")
        
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor()
            
            query = '''
                SELECT 
                    PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p20,
                    PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p40,
                    PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p60,
                    PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p80,
                    MIN(CAST(NULLIF("Fee", '') AS NUMERIC)) as min_fee,
                    MAX(CAST(NULLIF("Fee", '') AS NUMERIC)) as max_fee,
                    COUNT(*) as total_projects
                FROM "Sample"
                WHERE "Fee" IS NOT NULL 
                AND "Fee" != ''
                AND CAST(NULLIF("Fee", '') AS NUMERIC) > 0
            '''
            
            cursor.execute(query)
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            if result:
                p20, p40, p60, p80, min_fee, max_fee, total = result
                
                self.percentiles = {
                    'p20': float(p20),
                    'p40': float(p40),
                    'p60': float(p60),
                    'p80': float(p80),
                    'min': float(min_fee),
                    'max': float(max_fee),
                    'total_projects': int(total),
                    'calculated_at': datetime.now().isoformat()
                }
                
                self.last_calculated = datetime.now()
                
                if DEBUG_MODE:
                    print(f"✅ Percentiles calculated from {total} projects:")
                    print(f"   Micro:  ${min_fee:,.0f} - ${p20:,.0f} (bottom 20%)")
                    print(f"   Small:  ${p20:,.0f} - ${p40:,.0f} (20-40%)")
                    print(f"   Medium: ${p40:,.0f} - ${p60:,.0f} (40-60%)")
                    print(f"   Large:  ${p60:,.0f} - ${p80:,.0f} (60-80%)")
                    print(f"   Mega:   ${p80:,.0f} - ${max_fee:,.0f} (top 20%)")
                
                return self.percentiles
            
            return None
        
        except Exception as e:
            if DEBUG_MODE:
                print(f"❌ Error calculating percentiles: {str(e)}")
            return None
    
    def get_sql_case_statement(self) -> str:
        """
        Generate SQL CASE statement for dynamic size categorization
        """
        if not self.percentiles:
            self.calculate_percentiles()
        
        if not self.percentiles:
            # Fallback if calculation fails
            return '''CASE 
                WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 100000 THEN 'Micro (<$100K)'
                WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 1000000 THEN 'Small ($100K-$1M)'
                WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 10000000 THEN 'Medium ($1M-$10M)'
                WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 50000000 THEN 'Large ($10M-$50M)'
                ELSE 'Mega (>$50M)'
            END'''
        
        p = self.percentiles
        
        # Format values for display (in millions)
        p20_m = p['p20'] / 1e6
        p40_m = p['p40'] / 1e6
        p60_m = p['p60'] / 1e6
        p80_m = p['p80'] / 1e6
        
        return f'''CASE 
            WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < {p['p20']} 
                THEN 'Micro (<${p20_m:.1f}M)'
            WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= {p['p20']} AND CAST(NULLIF("Fee", '') AS NUMERIC) < {p['p40']} 
                THEN 'Small (${p20_m:.1f}M-${p40_m:.1f}M)'
            WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= {p['p40']} AND CAST(NULLIF("Fee", '') AS NUMERIC) < {p['p60']} 
                THEN 'Medium (${p40_m:.1f}M-${p60_m:.1f}M)'
            WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= {p['p60']} AND CAST(NULLIF("Fee", '') AS NUMERIC) < {p['p80']} 
                THEN 'Large (${p60_m:.1f}M-${p80_m:.1f}M)'
            ELSE 'Mega (>${p80_m:.1f}M)'
        END'''
    
    def get_size_category(self, fee: float) -> str:
        """Get size category for a given fee amount"""
        if not self.percentiles:
            self.calculate_percentiles()
        
        if not self.percentiles or fee is None or fee <= 0:
            return "unknown"
        
        p = self.percentiles
        
        if fee < p['p20']:
            return 'Micro'
        elif fee < p['p40']:
            return 'Small'
        elif fee < p['p60']:
            return 'Medium'
        elif fee < p['p80']:
            return 'Large'
        else:
            return 'Mega'


class QueryEngine:
    """Main query execution engine"""
    
    def __init__(self):
        self.openai_client = AzureOpenAIClient()
        self.date_calculator = DateCalculator()
        self.number_calculator = NumberCalculator()
        self.size_calculator = ProjectSizeCalculator()
        self.semantic_time_parser = SemanticTimeParser()
        
        # COMPREHENSIVE QUERY TEMPLATES
        self.query_templates = {
            
            # ═══════════════════════════════════════════════════════════════
            # BASIC DATE QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_year": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE EXTRACT(YEAR FROM "Start Date") = %s
                         AND "Start Date" > '2000-01-01'
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["year"],
                "param_types": ["int"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_date_range": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Start Date" >= %s::date 
                         AND "Start Date" <= %s::date
                         AND "Start Date" > '2000-01-01'
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["start_date", "end_date"],
                "param_types": ["str", "str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_quarter": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE EXTRACT(YEAR FROM "Start Date") = %s
                         AND EXTRACT(QUARTER FROM "Start Date") = %s
                         AND "Start Date" > '2000-01-01'
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["year", "quarter"],
                "param_types": ["int", "int"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_years": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE EXTRACT(YEAR FROM "Start Date") = ANY(%s)
                         AND "Start Date" > '2000-01-01'
                         ORDER BY "Start Date", CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["years"],
                "param_types": ["array"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # RANKING QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_largest_projects": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Fee" IS NOT NULL AND "Fee" != ''
                         {date_filter}
                         ORDER BY CAST("Fee" AS NUMERIC) DESC
                         {limit_clause}''',
                "params": [],
                "param_types": [],
                "optional_params": ["start_year", "end_year", "limit", "start_date", "end_date"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_smallest_projects": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Fee" IS NOT NULL AND "Fee" != ''
                         AND CAST("Fee" AS NUMERIC) > 0
                         {date_filter}
                         ORDER BY CAST("Fee" AS NUMERIC) ASC
                         {limit_clause}''',
                "params": [],
                "param_types": [],
                "optional_params": ["start_year", "end_year", "limit", "start_date", "end_date"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_largest_in_region": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "State Lookup" = %s::text
                         AND "Fee" IS NOT NULL AND "Fee" != ''
                         ORDER BY CAST("Fee" AS NUMERIC) DESC
                         {limit_clause}''',
                "params": ["state_code"],
                "param_types": ["str"],
                "optional_params": ["limit"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_largest_by_category": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Request Category" ILIKE %s
                         AND "Fee" IS NOT NULL AND "Fee" != ''
                         ORDER BY CAST("Fee" AS NUMERIC) DESC
                         {limit_clause}''',
                "params": ["category"],
                "param_types": ["str"],
                "optional_params": ["limit"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # CATEGORY / TYPE QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_category": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Request Category" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["category"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_project_type": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Project Type" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["project_type"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_multiple_categories": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Request Category" ILIKE ANY(%s)
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["categories"],
                "param_types": ["array"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },


            
            # ═══════════════════════════════════════════════════════════════
            # TAG QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_largest_by_tags": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Tags" ILIKE %s
                         AND "Fee" IS NOT NULL AND "Fee" != ''
                         ORDER BY CAST("Fee" AS NUMERIC) DESC
                         {limit_clause}''',
                "params": ["tag"],
                "param_types": ["str"],
                "optional_params": ["limit"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_tags": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Tags" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["tag"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_top_tags": {
                "sql": '''SELECT TRIM(UNNEST(string_to_array("Tags", ','))) as tag,
                         COUNT(*) as project_count,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
                         FROM "Sample"
                         WHERE "Tags" IS NOT NULL AND "Tags" != ''
                         GROUP BY tag
                         HAVING TRIM(UNNEST(string_to_array("Tags", ','))) != ''
                         ORDER BY total_value DESC NULLS LAST
                         {limit_clause}''',
                "params": [],
                "param_types": [],
                "optional_params": ["limit"],
                "chart_type": "bar",
                "chart_field": "total_value"
            },
            
            "get_top_tags_by_date": {
                "sql": '''SELECT TRIM(UNNEST(string_to_array("Tags", ','))) as tag,
                         COUNT(*) as project_count,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
                         FROM "Sample"
                         WHERE "Tags" IS NOT NULL AND "Tags" != ''
                         AND EXTRACT(YEAR FROM "Start Date") >= %s
                         AND EXTRACT(YEAR FROM "Start Date") <= %s
                         GROUP BY tag
                         HAVING TRIM(UNNEST(string_to_array("Tags", ','))) != ''
                         ORDER BY project_count DESC, total_value DESC NULLS LAST
                         {limit_clause}''',
                "params": ["start_year", "end_year"],
                "param_types": ["int", "int"],
                "optional_params": ["limit"],
                "chart_type": "bar",
                "chart_field": "project_count"
            },
            
            "get_projects_by_shared_tags": {
                "sql": '''WITH reference_tags AS (
                           SELECT UNNEST(string_to_array("Tags", ',')) as tag
                           FROM "Sample"
                           WHERE "Client" ILIKE %s OR "Project Name"::text ILIKE %s
                           LIMIT 1
                         )
                         SELECT DISTINCT s.*
                         FROM "Sample" s, reference_tags rt
                         WHERE s."Tags" ILIKE '%%' || rt.tag || '%%'
                         ORDER BY CAST(NULLIF(s."Fee", '') AS NUMERIC) DESC NULLS LAST
                         {limit_clause}''',
                "params": ["reference_client", "reference_project"],
                "param_types": ["str", "str"],
                "optional_params": ["limit"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },

            "get_projects_by_multiple_tags": {
                "sql": '''SELECT * FROM "Sample" 
                        WHERE "Tags" IS NOT NULL 
                        AND "Tags" != ''
                        {tag_conditions}
                        ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
                        {limit_clause}''',
                "params": [],  # Dynamic params
                "param_types": [],  # Dynamic types
                "optional_params": ["tag1", "tag2", "tag3", "tag4", "tag5", "limit"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # COMPANY / OPCO QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_company": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Company" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["company"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "compare_companies": {
                "sql": '''SELECT "Company",
                        COUNT(*) as project_count,
                        SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                        AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_size,
                        AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
                        FROM "Sample"
                        WHERE "Company" IS NOT NULL AND "Company" != ''
                        GROUP BY "Company"
                        ORDER BY total_revenue DESC NULLS LAST''',
                "params": [],
                "param_types": [],
                "chart_type": "bar",
                "chart_field": "total_revenue"
            },
            
            "compare_opco_revenue": {
                "sql": '''SELECT "Company",
                        COUNT(*) as project_count,
                        SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                        SUM(CAST(NULLIF("Fee", '') AS NUMERIC) * CAST(NULLIF("Win %%", '') AS NUMERIC) / 100) as predicted_revenue,
                        AVG(CAST(NULLIF("Win %%", '') AS NUMERIC)) as avg_win_rate
                        FROM "Sample"
                        WHERE ("Company" ILIKE ANY(%s))
                        AND "Status" NOT IN ('Won', 'Lost')
                        GROUP BY "Company"
                        ORDER BY predicted_revenue DESC NULLS LAST''',
                "params": ["companies"],
                "param_types": ["array"],
                "chart_type": "bar",
                "chart_field": "predicted_revenue"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # CLIENT QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_client": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Client" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["client"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_client_and_fee_range": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Client" ILIKE %s
                         AND CAST(NULLIF("Fee", '') AS NUMERIC) >= %s
                         AND CAST(NULLIF("Fee", '') AS NUMERIC) <= %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC''',
                "params": ["client", "min_fee", "max_fee"],
                "param_types": ["str", "float", "float"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_client_win_rates": {
                "sql": '''SELECT "Client",
                         COUNT(*) as project_count,
                         AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value
                         FROM "Sample"
                         WHERE "Client" ILIKE %s
                         AND "Win %" IS NOT NULL AND "Win %" != ''
                         GROUP BY "Client"
                         ORDER BY avg_win_rate DESC''',
                "params": ["client"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "avg_win_rate"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # STATUS QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_status": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Status" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["status"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_status_breakdown": {
                "sql": '''SELECT "Status",
                        COUNT(*) as project_count,
                        SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                        AVG(CAST(NULLIF("Win %", '') AS NUMERIC)) as avg_win_rate
                        FROM "Sample"
                        GROUP BY "Status"
                        ORDER BY total_value DESC NULLS LAST''',
                "params": [],
                "param_types": [],
                "chart_type": "pie",
                "chart_field": "project_count"
            },
            
            "get_overoptimistic_losses": {
                "sql": '''SELECT * FROM "Sample"
                        WHERE "Status" ~* 'lost'
                        AND CAST(NULLIF("Win %", '') AS NUMERIC) > 70
                        ORDER BY CAST(NULLIF("Win %", '') AS NUMERIC) DESC''',
                "params": [],
                "param_types": [],
                "chart_type": "bar",
                "chart_field": "Win %"
            },
            
            "get_top_predicted_wins": {
                "sql": '''SELECT * FROM "Sample"
                         WHERE "Status" NOT IN ('Won', 'Lost')
                         AND "Win %%" IS NOT NULL AND "Win %%" != ''
                         AND CAST(NULLIF("Win %%", '') AS NUMERIC) > 50
                         AND "Start Date" >= CURRENT_DATE
                         AND "Start Date" <= CURRENT_DATE + INTERVAL '6 months'
                         ORDER BY CAST(NULLIF("Win %%", '') AS NUMERIC) DESC,
                                  CAST(NULLIF("Fee", '') AS NUMERIC) DESC
                         LIMIT %s''',
                "params": ["limit"],
                "param_types": ["int"],
                "chart_type": "bar",
                "chart_field": "Win %"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # WIN RATE QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_project_win_rate": {
                "sql": '''SELECT "Project Name", "Win %", "Status", "Fee", 
                         "Request Category", "Company", "Point Of Contact", "Tags"
                         FROM "Sample"
                         WHERE "Project Name"::text ILIKE %s''',
                "params": ["project_name"],
                "param_types": ["str"],
                "chart_type": "none",
                "chart_field": None
            },
            
            "get_projects_by_win_range": {
                "sql": '''SELECT * FROM "Sample" 
                        WHERE CAST(NULLIF("Win %%", '') AS NUMERIC) >= %s
                        AND CAST(NULLIF("Win %%", '') AS NUMERIC) <= %s
                        ORDER BY CAST(NULLIF("Win %%", '') AS NUMERIC) DESC''',
                "params": ["min_win", "max_win"],
                "param_types": ["int", "int"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "predict_win_probability": {
                "sql": '''SELECT 
                        p."Project Name",
                        CAST(NULLIF(p."Win %", '') AS NUMERIC) as "Win_Percentage",
                        p."Status",
                        CAST(NULLIF(p."Fee", '') AS NUMERIC) as "Fee",
                        p."Request Category",
                        p."Company",
                        p."Point Of Contact",
                        p."Tags",
                        (SELECT COALESCE(AVG(CAST(NULLIF(s."Win %", '') AS NUMERIC)), 0)
                            FROM "Sample" s
                            WHERE s."Request Category" = p."Request Category"
                            AND s."Company" = p."Company"
                            AND s."Project Name" != p."Project Name"
                            AND s."Win %" IS NOT NULL
                            AND s."Win %" != '') as similar_avg_win_rate,
                        (SELECT COUNT(*)
                            FROM "Sample" s
                            WHERE s."Request Category" = p."Request Category"
                            AND s."Company" = p."Company"
                            AND s."Project Name" != p."Project Name"
                            AND s."Win %" IS NOT NULL
                            AND s."Win %" != '') as similar_projects_count,
                        CASE
                            WHEN CAST(NULLIF(p."Win %", '') AS NUMERIC) >= 70 THEN 'High probability - Strong likelihood of winning'
                            WHEN CAST(NULLIF(p."Win %", '') AS NUMERIC) >= 50 THEN 'Medium-High probability - Good chance'
                            WHEN CAST(NULLIF(p."Win %", '') AS NUMERIC) >= 30 THEN 'Medium probability - Competitive situation'
                            WHEN CAST(NULLIF(p."Win %", '') AS NUMERIC) >= 10 THEN 'Low-Medium probability - Challenging'
                            ELSE 'Low probability - Consider strategic approach'
                        END as prediction,
                        CASE
                            WHEN p."Status" ~* 'won' THEN 'Project already won!'
                            WHEN p."Status" ~* 'lost' THEN 'Project was not won'
                            WHEN p."Status" ~* 'submitted' THEN 'Proposal submitted - awaiting decision'
                            WHEN p."Status" ~* 'lead' THEN 'Early stage - continue nurturing'
                            ELSE 'Status: ' || p."Status"
                        END as status_insight
                        FROM "Sample" p
                        WHERE p."Project Name"::text ILIKE %s
                        LIMIT 1''',
                "params": ["project_name"],
                "param_types": ["str"],
                "chart_type": "none",
                "chart_field": None
            },
            
            # ═══════════════════════════════════════════════════════════════
            # REGION / STATE QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_state": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "State Lookup" = %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["state_code"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # FEE / SIZE QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_fee_range": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Fee" IS NOT NULL AND "Fee" != ''
                         AND CAST("Fee" AS NUMERIC) >= %s
                         {max_fee_filter}
                         ORDER BY CAST("Fee" AS NUMERIC) DESC''',
                "params": ["min_fee"],
                "param_types": ["float"],
                "optional_params": ["max_fee"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_projects_by_size": {
                "sql": '''SELECT 
                        *
                        FROM "Sample" 
                        WHERE "Fee" IS NOT NULL AND "Fee" != ''
                        AND CAST(NULLIF("Fee", '') AS NUMERIC) > 0
                        AND {size_case_statement} = %s
                        ORDER BY CAST("Fee" AS NUMERIC) DESC''',
                "params": ["size"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_size_distribution": {
                "sql": '''SELECT 
                        {size_case_statement} as size_tier,
                        COUNT(*) as project_count,
                        ROUND(SUM(CAST(NULLIF("Fee", '') AS NUMERIC))::numeric, 0) as total_value,
                        ROUND(AVG(CAST(NULLIF("Fee", '') AS NUMERIC))::numeric, 0) as avg_fee,
                        ROUND(MIN(CAST(NULLIF("Fee", '') AS NUMERIC))::numeric, 0) as min_fee,
                        ROUND(MAX(CAST(NULLIF("Fee", '') AS NUMERIC))::numeric, 0) as max_fee,
                        ROUND(AVG(CAST(NULLIF("Win %", '') AS NUMERIC))::numeric, 1) as avg_win_rate
                        FROM "Sample" 
                        WHERE "Fee" IS NOT NULL AND "Fee" != ''
                        AND CAST(NULLIF("Fee", '') AS NUMERIC) > 0
                        GROUP BY size_tier
                        ORDER BY MIN(CAST(NULLIF("Fee", '') AS NUMERIC))''',
                "params": [],
                "param_types": [],
                "chart_type": "pie",
                "chart_field": "project_count"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # SIMILAR / RELATED PROJECTS
            # ═══════════════════════════════════════════════════════════════
            
            "get_similar_projects": {
                "sql": '''WITH target AS (
                           SELECT "Request Category", "Company", "Fee", "Tags"
                           FROM "Sample" 
                           WHERE "Project Name"::text ILIKE %s 
                           LIMIT 1
                         )
                         SELECT s.*, 
                           ABS(CAST(NULLIF(s."Fee", '') AS NUMERIC) - CAST(NULLIF(t."Fee", '') AS NUMERIC)) as fee_diff
                         FROM "Sample" s, target t
                         WHERE s."Request Category" = t."Request Category"
                         AND s."Company" = t."Company"
                         AND s."Project Name"::text NOT ILIKE %s
                         ORDER BY fee_diff
                         LIMIT 10''',
                "params": ["project_name", "project_name"],
                "param_types": ["str", "str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "compare_project_with_similar": {
                "sql": '''WITH target_project AS (
                           SELECT * FROM "Sample" WHERE "Project Name"::text ILIKE %s LIMIT 1
                         )
                         SELECT s.*, 
                           CASE WHEN s."Project Name"::text ILIKE %s THEN 1 ELSE 0 END as is_target
                         FROM "Sample" s, target_project tp
                         WHERE s."Request Category" = tp."Request Category"
                         AND s."Company" = tp."Company"
                         ORDER BY ABS(CAST(NULLIF(s."Fee", '') AS NUMERIC) - CAST(NULLIF(tp."Fee", '') AS NUMERIC))
                         LIMIT 20''',
                "params": ["project_name", "project_name"],
                "param_types": ["str", "str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            "get_related_projects": {
                "sql": '''WITH target_tags AS (
                           SELECT UNNEST(string_to_array("Tags", ',')) as tag
                           FROM "Sample"
                           WHERE "Project Name"::text ILIKE %s
                           LIMIT 1
                         )
                         SELECT DISTINCT s.*,
                           (SELECT COUNT(*) FROM target_tags tt WHERE s."Tags" ILIKE '%%' || tt.tag || '%%') as matching_tags
                         FROM "Sample" s
                         WHERE EXISTS (
                           SELECT 1 FROM target_tags tt WHERE s."Tags" ILIKE '%%' || tt.tag || '%%'
                         )
                         AND s."Project Name"::text NOT ILIKE %s
                         ORDER BY matching_tags DESC, CAST(NULLIF(s."Fee", '') AS NUMERIC) DESC NULLS LAST
                         LIMIT 20''',
                "params": ["project_name", "project_name"],
                "param_types": ["str", "str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },

            "get_projects_by_status_and_win_rate": {
                "sql": '''SELECT * FROM "Sample"
                        WHERE "Status" ILIKE %s
                        AND "Win %%" IS NOT NULL AND "Win %%" != ''
                        AND CAST(NULLIF("Win %%", '') AS NUMERIC) > %s
                        ORDER BY CAST(NULLIF("Win %%", '') AS NUMERIC) DESC''',
                "params": ["status", "min_win"],
                "param_types": ["str", "int"],
                "chart_type": "bar",
                "chart_field": "Win %"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # DURATION ANALYSIS
            # ═══════════════════════════════════════════════════════════════
            
            "analyze_pursuit_duration": {
                "sql": '''SELECT
                        "Company",
                        "Status",
                        "Request Category",
                        COUNT(*) as total_pursuits,
                        ROUND(AVG(EXTRACT(DAY FROM (CURRENT_DATE - "Start Date")))) as avg_days_old,
                        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(DAY FROM (CURRENT_DATE - "Start Date")))) as median_days_old,
                        MIN(EXTRACT(DAY FROM (CURRENT_DATE - "Start Date"))) as newest_pursuit_days,
                        MAX(EXTRACT(DAY FROM (CURRENT_DATE - "Start Date"))) as oldest_pursuit_days,
                        TO_CHAR(MIN("Start Date"), 'YYYY-MM-DD') as oldest_start_date,
                        TO_CHAR(MAX("Start Date"), 'YYYY-MM-DD') as newest_start_date,
                        ROUND(AVG(CAST(NULLIF("Win %", '') AS NUMERIC))::numeric, 1) as avg_win_rate,
                        ROUND(SUM(CAST(NULLIF("Fee", '') AS NUMERIC))::numeric, 0) as total_value
                        FROM "Sample"
                        WHERE "Status" IN ('Won', 'Lost')
                        AND "Start Date" IS NOT NULL
                        AND "Start Date" > '2020-01-01'
                        AND "Start Date" <= CURRENT_DATE
                        GROUP BY "Company", "Status", "Request Category"
                        HAVING COUNT(*) >= 2
                        ORDER BY "Company", "Status", avg_days_old DESC''',
                "params": [],
                "param_types": [],
                "chart_type": "bar",
                "chart_field": "avg_days_old"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # SORTING & LISTING
            # ═══════════════════════════════════════════════════════════════
            
            "get_all_projects": {
                "sql": '''SELECT "Project Type", "Start Date", "Fee", "Client", 
                         "Project Name", "Status", "Company", "Win %", "Tags"
                         FROM "Sample"
                         ORDER BY "Start Date" DESC NULLS LAST''',
                "params": [],
                "param_types": [],
                "chart_type": "none",
                "chart_field": None
            },
            
            "get_projects_sorted": {
                "sql": '''SELECT * FROM "Sample"
                         WHERE "Win %" IS NOT NULL AND "Win %" != ''
                         AND "Fee" IS NOT NULL AND "Fee" != ''
                         ORDER BY 
                           CAST(NULLIF("Win %", '') AS NUMERIC) DESC,
                           CAST(NULLIF("Fee", '') AS NUMERIC) DESC''',
                "params": [],
                "param_types": [],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # GROUPING & ANALYSIS
            # ═══════════════════════════════════════════════════════════════
            
            "group_projects_by_type_size": {
                "sql": '''SELECT 
                        "Project Type",
                        {size_case_statement} as size_category,
                        COUNT(*) as project_count,
                        ROUND(SUM(CAST(NULLIF("Fee", '') AS NUMERIC))::numeric, 0) as total_value,
                        ROUND(AVG(CAST(NULLIF("Win %", '') AS NUMERIC))::numeric, 1) as avg_win_rate
                        FROM "Sample"
                        WHERE "Fee" IS NOT NULL AND "Fee" != ''
                        AND CAST(NULLIF("Fee", '') AS NUMERIC) > 0
                        GROUP BY "Project Type", size_category
                        ORDER BY "Project Type", MIN(CAST(NULLIF("Fee", '') AS NUMERIC))''',
                "params": [],
                "param_types": [],
                "chart_type": "bar",
                "chart_field": "total_value"
            },

            "get_projects_by_combined_filters": {
                "sql": '''SELECT * FROM "Sample" 
                        WHERE 1=1
                        {size_filter}
                        {category_filter}
                        {tag_filter}
                        {status_filter}
                        {company_filter}
                        {state_filter}
                        {fee_filter}
                        {win_filter}
                        {date_filter}
                        AND "Start Date" > '2000-01-01'
                        ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST
                        {limit_clause}''',
                "params": [],
                "param_types": [],
                "optional_params": ["size", "categories", "tags", "status", "company", 
                                    "state_code", "min_fee", "max_fee", "min_win", "max_win",
                                    "start_date", "end_date", "limit"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # CONTACT QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_projects_by_contact": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Point Of Contact" ILIKE %s
                         ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC) DESC NULLS LAST''',
                "params": ["contact_name"],
                "param_types": ["str"],
                "chart_type": "bar",
                "chart_field": "Fee"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # SPECIFIC PROJECT LOOKUP
            # ═══════════════════════════════════════════════════════════════
            
            "get_project_by_id": {
                "sql": '''SELECT * FROM "Sample" 
                         WHERE "Project Name"::text ILIKE %s OR "Internal Id" ILIKE %s''',
                "params": ["project_name", "internal_id"],
                "param_types": ["str", "str"],
                "chart_type": "none",
                "chart_field": None
            },
            
            # ═══════════════════════════════════════════════════════════════
            # ENHANCED: REVENUE AGGREGATION QUERIES
            # ═══════════════════════════════════════════════════════════════
            
            "get_revenue_by_category": {
                "sql": '''SELECT 
                         "Request Category",
                         COUNT(*) as project_count,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                         AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_revenue,
                         AVG(CAST(NULLIF("Win %%", '') AS NUMERIC)) as avg_win_rate
                         FROM "Sample"
                         WHERE "Request Category" ILIKE %s
                         {status_filter}
                         GROUP BY "Request Category"''',
                "params": ["category"],
                "param_types": ["str"],
                "optional_params": ["status"],
                "chart_type": "none",
                "chart_field": None
            },
            
            # ═══════════════════════════════════════════════════════════════
            # ENHANCED: WEIGHTED REVENUE PROJECTION ("WHAT IF" SCENARIOS)
            # ═══════════════════════════════════════════════════════════════
            
            "get_weighted_revenue_projection": {
                "sql": '''SELECT 
                         "Status",
                         COUNT(*) as project_count,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_value,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC) * 
                             CAST(NULLIF("Win %%", '') AS NUMERIC) / 100) as weighted_expected_value,
                         AVG(CAST(NULLIF("Win %%", '') AS NUMERIC)) as avg_win_rate
                         FROM "Sample"
                         WHERE "Status" NOT IN ('Won', 'Lost')
                         AND "Win %%" IS NOT NULL AND "Win %%" != ''
                         GROUP BY "Status"
                         ORDER BY weighted_expected_value DESC''',
                "params": [],
                "param_types": [],
                "chart_type": "bar",
                "chart_field": "weighted_expected_value"
            },
            
            # ═══════════════════════════════════════════════════════════════
            # ENHANCED: YEAR-OVER-YEAR COMPARISON
            # ═══════════════════════════════════════════════════════════════
            
            "compare_years": {
                "sql": '''SELECT 
                         EXTRACT(YEAR FROM "Start Date") as year,
                         COUNT(*) as project_count,
                         SUM(CAST(NULLIF("Fee", '') AS NUMERIC)) as total_revenue,
                         AVG(CAST(NULLIF("Fee", '') AS NUMERIC)) as avg_project_size,
                         AVG(CAST(NULLIF("Win %%", '') AS NUMERIC)) as avg_win_rate
                         FROM "Sample"
                         WHERE EXTRACT(YEAR FROM "Start Date") IN (%s, %s)
                         AND "Start Date" > '2000-01-01'
                         GROUP BY year
                         ORDER BY year''',
                "params": ["year1", "year2"],
                "param_types": ["int", "int"],
                "chart_type": "bar",
                "chart_field": "total_revenue"
            }
        }
        
        # FUNCTION DEFINITIONS FOR GPT-4o (simplified - no calculation examples)
        self.function_definitions = [
            # Date-based
            {"name": "get_projects_by_year", "description": "Get all projects in a specific year", 
             "parameters": {"type": "object", "properties": {"year": {"type": "integer"}}, "required": ["year"]}},
            
            {"name": "get_projects_by_date_range", "description": "Get projects between two dates", 
             "parameters": {"type": "object", "properties": {"start_date": {"type": "string"}, "end_date": {"type": "string"}}, "required": ["start_date", "end_date"]}},
            
            {"name": "get_projects_by_quarter", "description": "Get projects in specific quarter", 
             "parameters": {"type": "object", "properties": {"year": {"type": "integer"}, "quarter": {"type": "integer"}}, "required": ["year", "quarter"]}},
            
            {"name": "get_projects_by_years", "description": "Get projects in multiple years", 
             "parameters": {"type": "object", "properties": {"years": {"type": "array", "items": {"type": "integer"}}}, "required": ["years"]}},

            {"name": "get_projects_by_combined_filters", 
            "description": "Get projects matching MULTIPLE filters simultaneously...", 
            "parameters": {
                "type": "object", 
                "properties": {
                    "size": {"type": "string", "description": "Size category: Micro, Small, Medium, Large, Mega"},
                    "categories": {"type": "array", "items": {"type": "string"}, "description": "List of request categories"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "List of tags"},
                    "status": {"type": "string", "description": "Project status"},
                    "company": {"type": "string", "description": "Company/OPCO name"},
                    "state_code": {"type": "string", "description": "State lookup code"},
                    "min_fee": {"type": "number", "description": "Minimum fee amount"},
                    "max_fee": {"type": "number", "description": "Maximum fee amount"},
                    "min_win": {"type": "integer", "description": "Minimum win percentage"},
                    "max_win": {"type": "integer", "description": "Maximum win percentage"},
                    
                    # NEW: Semantic time reference instead of exact dates
                    "time_reference": {
                        "type": "string", 
                        "description": "Natural language time reference. Extract the EXACT user's time phrase. Examples: 'next ten months', 'coming months', 'near future', 'this quarter', 'soon', 'next year', 'last 6 months', 'Q1 2026', 			'in 2026', 'between January and March 2026'. DO NOT calculate dates - just extract the user's time phrase as-is."
                    },
                    
                    "limit": {"type": "integer", "description": "Result limit"}
                }, 
                "required": []
            }
            },
            
            # Rankings
            {"name": "get_largest_projects", "description": "Get largest/highest/biggest/top projects by fee", 
             "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "required": []}},
            
            {"name": "get_smallest_projects", "description": "Get smallest/lowest projects by fee", 
             "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "required": []}},
            
            {"name": "get_largest_in_region", "description": "Get largest pursuits in specific region/state", 
             "parameters": {"type": "object", "properties": {"state_code": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["state_code"]}},
            
            {"name": "get_largest_by_category", "description": "Get largest projects in REQUEST CATEGORY field (Healthcare category, Education category, Transportation category, etc.). DO NOT use if user explicitly mentions 'tags'.", 
             "parameters": {"type": "object", "properties": {"category": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["category"]}},
            
            # Category/Type
            {"name": "get_projects_by_category", "description": "Get projects by request category", 
             "parameters": {"type": "object", "properties": {"category": {"type": "string"}}, "required": ["category"]}},
            
            {"name": "get_projects_by_project_type", "description": "Get projects by project type", 
             "parameters": {"type": "object", "properties": {"project_type": {"type": "string"}}, "required": ["project_type"]}},
            
            {"name": "get_projects_by_multiple_categories", "description": "Get projects in multiple categories", 
             "parameters": {"type": "object", "properties": {"categories": {"type": "array", "items": {"type": "string"}}}, "required": ["categories"]}},
            
            # Tags
            {"name": "get_largest_by_tags", "description": "Get largest/top/biggest projects with specific TAGS. Use this when user explicitly mentions 'tags', 'tagged', or phrases like 'largest healthcare tags', 'top projects with X 	      tags'.", 
             "parameters": {"type": "object", "properties": {"tag": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["tag"]}},

            {"name": "get_projects_by_status_and_win_rate", 
            "description": "Get projects by specific status (submitted, lost, won, lead, proposal development, etc.) combined with win percentage threshold. Use when user asks for projects with BOTH status AND win rate conditions. 		     Examples: 'submitted projects with Win% > 70%', 'lost projects with Win% > 60%', 'won projects with Win% < 50%'.", 
            "parameters": {
                "type": "object", 
                "properties": {
                    "status": {"type": "string", "description": "Project status: submitted, lost, won, lead, proposal development, active, etc."}, 
                    "min_win": {"type": "integer", "description": "Minimum win percentage threshold (e.g., 70 for >70%)"}
                }, 
                "required": ["status", "min_win"]
            }
            },

            {"name": "get_projects_by_multiple_tags", 
            "description": "Get projects that have ALL specified tags. Use when user mentions multiple tags with 'and', '&', or commas. Examples: 'Rail and Transit tags', 'Transportation, Infrastructure, and Rail tags', 'projects with 	     Rail & Transit & Infrastructure'.", 
            "parameters": {
                "type": "object", 
                "properties": {
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "List of tags to search for (up to 5 tags). Project must have ALL tags."}
                }, 
                "required": ["tags"]
            }},
            
            {"name": "get_projects_by_tags", "description": "Get ALL projects with specific tags (not sorted by size). Use when user asks for 'projects with X tag' without mentioning 'largest' or 'top'.", 
             "parameters": {"type": "object", "properties": {"tag": {"type": "string"}}, "required": ["tag"]}},
            
            {"name": "get_top_tags", "description": "Get top tags across all projects", 
             "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "required": []}},
            
            {"name": "get_top_tags_by_date", "description": "Get top tags for projects in specific date range", 
             "parameters": {"type": "object", "properties": {"start_year": {"type": "integer"}, "end_year": {"type": "integer"}, "limit": {"type": "integer"}}, "required": ["start_year", "end_year"]}},
            
            {"name": "get_projects_by_shared_tags", "description": "Get projects sharing tags with a reference project or client", 
             "parameters": {"type": "object", "properties": {"reference_client": {"type": "string"}, "reference_project": {"type": "string"}, "limit": {"type": "integer"}}, "required": []}},
            
            # Company/OPCO
            {"name": "get_projects_by_company", "description": "Get projects by company/OPCO", 
             "parameters": {"type": "object", "properties": {"company": {"type": "string"}}, "required": ["company"]}},
            
            {"name": "compare_companies", "description": "Compare all companies by revenue, count, win rate", 
             "parameters": {"type": "object", "properties": {}, "required": []}},
            
            {"name": "compare_opco_revenue", "description": "Compare predicted revenue between specific OPCOs/companies", 
             "parameters": {"type": "object", "properties": {"companies": {"type": "array", "items": {"type": "string"}}}, "required": ["companies"]}},
            
            # Client
            {"name": "get_projects_by_client", "description": "Get all projects for specific client", 
             "parameters": {"type": "object", "properties": {"client": {"type": "string"}}, "required": ["client"]}},
            
            {"name": "get_projects_by_client_and_fee_range", "description": "Get projects for client within fee range", 
             "parameters": {"type": "object", "properties": {"client": {"type": "string"}, "min_fee": {"type": "number"}, "max_fee": {"type": "number"}}, "required": ["client", "min_fee", "max_fee"]}},
            
            {"name": "get_client_win_rates", "description": "Get win rates for specific client", 
             "parameters": {"type": "object", "properties": {"client": {"type": "string"}}, "required": ["client"]}},
            
            # Status
            {"name": "get_projects_by_status", "description": "Get projects by status", 
             "parameters": {"type": "object", "properties": {"status": {"type": "string"}}, "required": ["status"]}},
            
            {"name": "get_status_breakdown", "description": "Get breakdown of all projects by status", 
             "parameters": {"type": "object", "properties": {}, "required": []}},
            
            {"name": "get_overoptimistic_losses", 
            "description": "Get LOST projects where win percentage was above 70%. ONLY use when user specifically asks about 'overoptimistic losses', 'lost projects with high predictions', or 'losses we thought we would win'. DO NOT use for 'submitted' or 'active' projects.", 
            "parameters": {"type": "object", "properties": {}, "required": []}},
            
            {"name": "get_top_predicted_wins", "description": "Get top N projects predicted to win", 
             "parameters": {"type": "object", "properties": {"limit": {"type": "integer"}}, "required": ["limit"]}},
            
            # Win Rate
            {"name": "get_project_win_rate", "description": "Get win rate for specific project", 
             "parameters": {"type": "object", "properties": {"project_name": {"type": "string"}}, "required": ["project_name"]}},
            
            {"name": "get_projects_by_win_range", "description": "Get projects with win percentage in range", 
             "parameters": {"type": "object", "properties": {"min_win": {"type": "integer"}, "max_win": {"type": "integer"}}, "required": ["min_win", "max_win"]}},
            
            {"name": "predict_win_probability", "description": "Predict if we will win/get a project", 
             "parameters": {"type": "object", "properties": {"project_name": {"type": "string"}}, "required": ["project_name"]}},
            
            # Region
            {"name": "get_projects_by_state", "description": "Get projects in specific state/region", 
             "parameters": {"type": "object", "properties": {"state_code": {"type": "string"}}, "required": ["state_code"]}},
            
            # Fee/Size
            {"name": "get_projects_by_fee_range", "description": "Get projects within fee range", 
             "parameters": {"type": "object", "properties": {"min_fee": {"type": "number"}, "max_fee": {"type": "number"}}, "required": ["min_fee"]}},
            
            {"name": "get_projects_by_size", 
            "description": "Get projects by DYNAMIC size category calculated from percentiles. Size is one of: 'Micro (<p20)', 'Small (p20-p40)', 'Medium (p40-p60)', 'Large (p60-p80)', 'Mega (>p80)'. The exact dollar ranges are calculated dynamically from actual data distribution.", 
            "parameters": {"type": "object", "properties": {"size": {"type": "string", "description": "Size category - match exactly as shown: 'Micro', 'Small', 'Medium', 'Large', or 'Mega'"}}, "required": ["size"]}},

            {"name": "get_size_distribution", 
            "description": "Get distribution of projects by DYNAMIC size tiers calculated from actual fee percentiles (20%, 40%, 60%, 80%). Shows project count and total value for each tier.", 
            "parameters": {"type": "object", "properties": {}, "required": []}},
            
            # Similar Projects
            {"name": "get_similar_projects", "description": "Find similar projects to a given project", 
             "parameters": {"type": "object", "properties": {"project_name": {"type": "string"}}, "required": ["project_name"]}},
            
            {"name": "compare_project_with_similar", "description": "Compare specific project with similar ones", 
             "parameters": {"type": "object", "properties": {"project_name": {"type": "string"}}, "required": ["project_name"]}},
            
            {"name": "get_related_projects", "description": "Get related projects based on shared tags", 
             "parameters": {"type": "object", "properties": {"project_name": {"type": "string"}}, "required": ["project_name"]}},
            
            # Duration
            {"name": "analyze_pursuit_duration", "description": "Analyze pursuit duration from lead to win/loss", 
             "parameters": {"type": "object", "properties": {}, "required": []}},
            
            # Sorting/Listing
            {"name": "get_all_projects", "description": "List all projects with basic fields", 
             "parameters": {"type": "object", "properties": {}, "required": []}},
            
            {"name": "get_projects_sorted", "description": "Get projects sorted by win percentage then fee amount", 
             "parameters": {"type": "object", "properties": {}, "required": []}},
            
            # Grouping
            {"name": "group_projects_by_type_size", "description": "Group projects by type and size category", 
             "parameters": {"type": "object", "properties": {}, "required": []}},
            
            # Contact
            {"name": "get_projects_by_contact", "description": "Get projects by point of contact person", 
             "parameters": {"type": "object", "properties": {"contact_name": {"type": "string"}}, "required": ["contact_name"]}},
            
            # Lookup
            {"name": "get_project_by_id", "description": "Find specific project by name or ID", 
             "parameters": {"type": "object", "properties": {"project_name": {"type": "string"}, "internal_id": {"type": "string"}}, "required": ["project_name"]}},
            
            # ENHANCED: Revenue Aggregation
            {"name": "get_revenue_by_category", 
            "description": "Get total revenue aggregated by category. Use when user asks 'total revenue in X', 'how much money in X category', 'value of X projects', 'revenue for X status'.", 
            "parameters": {
                "type": "object", 
                "properties": {
                    "category": {"type": "string", "description": "Request category"},
                    "status": {"type": "string", "description": "Optional: filter by status"}
                }, 
                "required": ["category"]
            }},
            
            # ENHANCED: What-If Projections
            {"name": "get_weighted_revenue_projection", 
            "description": "Get weighted revenue projections based on win probability. Use for 'what if' scenarios like 'predicted revenue if we win', 'expected value', 'potential revenue'.", 
            "parameters": {"type": "object", "properties": {}, "required": []}},
            
            # ENHANCED: Year Comparisons
            {"name": "compare_years", 
            "description": "Compare two specific years side-by-side. Use for 'compare 2025 vs 2026', 'year over year', '2025 compared to 2026'.", 
            "parameters": {
                "type": "object", 
                "properties": {
                    "year1": {"type": "integer", "description": "First year to compare"},
                    "year2": {"type": "integer", "description": "Second year to compare"}
                }, 
                "required": ["year1", "year2"]
            }}
        ]
    
    def preprocess_query(self, user_question: str, classification: Dict) -> Dict:
        """
        Preprocess query to handle ALL calculations in Python
        
        This runs AFTER LLM classification and overrides with calculated values.
        """
        
        if DEBUG_MODE:
            print("\n🔧 PREPROCESSING QUERY...")
            print(f"Original classification: {classification}")
        
        # Initialize semantic time parser
        time_parser = SemanticTimeParser()
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 0: PROCESS SEMANTIC TIME REFERENCES
        # ═══════════════════════════════════════════════════════════════
        
        args = classification.get("arguments", {})
        
        if "time_reference" in args and args["time_reference"]:
            time_ref = args["time_reference"]
            
            if DEBUG_MODE:
                print(f"🕒 Processing time reference: '{time_ref}'")
            
            # Parse using semantic parser
            date_range = time_parser.parse(time_ref)
            
            if date_range:
                start_date, end_date = date_range
                args["start_date"] = start_date
                args["end_date"] = end_date
                
                # Remove the semantic reference
                del args["time_reference"]
                
                if DEBUG_MODE:
                    print(f"✅ Converted to dates: {start_date} to {end_date}")
            else:
                if DEBUG_MODE:
                    print(f"⚠️  Could not parse time reference: '{time_ref}'")
                del args["time_reference"]
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 0.5: STATUS NORMALIZATION (ENHANCED)
        # ═══════════════════════════════════════════════════════════════
        
        if "status" in classification["arguments"]:
            status = classification["arguments"]["status"].lower()
            
            # Normalize common variations
            if status in ["won", "win", "winning", "successful", "awarded"]:
                classification["arguments"]["status"] = "won"
            elif status in ["lost", "lose", "losing", "unsuccessful", "rejected"]:
                classification["arguments"]["status"] = "lost"
            elif status in ["submit", "submitted", "pending", "awaiting"]:
                classification["arguments"]["status"] = "submitted"
            elif status in ["lead", "leads", "opportunity", "opportunities"]:
                classification["arguments"]["status"] = "lead"
            elif status in ["proposal", "proposal development", "developing"]:
                classification["arguments"]["status"] = "proposal development"
            
            if DEBUG_MODE:
                print(f"✅ Status normalized: '{status}' → '{classification['arguments']['status']}'")
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 0.75: TAG vs CATEGORY DISAMBIGUATION (ENHANCED FOR MULTI-TAG)
        # ═══════════════════════════════════════════════════════════════
        
        user_question_lower = user_question.lower()
        
        # Detect if user explicitly mentions "tags"
        has_tag_keyword = any(keyword in user_question_lower for keyword in [
            "tag", "tags", "tagged", "tagged as", "tagged with"
        ])
        
        # Detect if user mentions "category" explicitly
        has_category_keyword = any(keyword in user_question_lower for keyword in [
            "category", "categories", "request category", "market segment"
        ])
        
        if DEBUG_MODE:
            print(f"🔍 Tag keyword detected: {has_tag_keyword}")
            print(f"🔍 Category keyword detected: {has_category_keyword}")
        
        # Override category-based functions if user mentions "tags"
        if has_tag_keyword and not has_category_keyword:
            if classification["function_name"] == "get_largest_by_category":
                # Extract the value that was classified as "category"
                tag_value = classification["arguments"].get("category", "")
                
                # Parse multiple tags from the value
                tags = DateCalculator._parse_multiple_items(tag_value)
                
                # Check if user wants ranking/largest
                is_ranking_query = any(word in user_question_lower for word in [
                    "largest", "biggest", "top", "highest", "greatest", "major"
                ])
                
                if len(tags) > 1:
                    # Multiple tags detected
                    classification["function_name"] = "get_projects_by_multiple_tags"
                    classification["arguments"] = {"tags": tags}
                    if DEBUG_MODE:
                        print(f"✅ OVERRIDE: Multi-tag query detected → {tags}")
                elif is_ranking_query:
                    classification["function_name"] = "get_largest_by_tags"
                    classification["arguments"] = {"tag": tags[0]}
                    if DEBUG_MODE:
                        print(f"✅ OVERRIDE: Changed get_largest_by_category → get_largest_by_tags")
                else:
                    classification["function_name"] = "get_projects_by_tags"
                    classification["arguments"] = {"tag": tags[0]}
                    if DEBUG_MODE:
                        print(f"✅ OVERRIDE: Changed get_largest_by_category → get_projects_by_tags")
                
                # Preserve limit if it exists
                limit_value = classification.get("arguments", {}).get("limit")
                if limit_value:
                    classification["arguments"]["limit"] = limit_value
            
            elif classification["function_name"] == "get_projects_by_category":
                # Simple category query → tag query
                tag_value = classification["arguments"].get("category", "")
                tags = DateCalculator._parse_multiple_items(tag_value)
                
                if len(tags) > 1:
                    classification["function_name"] = "get_projects_by_multiple_tags"
                    classification["arguments"] = {"tags": tags}
                else:
                    classification["function_name"] = "get_projects_by_tags"
                    classification["arguments"] = {"tag": tags[0]}
                
                if DEBUG_MODE:
                    print(f"✅ OVERRIDE: Changed get_projects_by_category → get_projects_by_tags")
            
            elif classification["function_name"] == "get_projects_by_tags":
                # Check if single tag contains multiple items
                tag_value = classification["arguments"].get("tag", "")
                tags = DateCalculator._parse_multiple_items(tag_value)
                
                if len(tags) > 1:
                    classification["function_name"] = "get_projects_by_multiple_tags"
                    classification["arguments"] = {"tags": tags}
                    if DEBUG_MODE:
                        print(f"✅ OVERRIDE: Single tag split into multi-tag → {tags}")
        
        # Handle explicit multi-tag queries from GPT-4o
        if classification["function_name"] == "get_projects_by_multiple_tags":
            tags = classification["arguments"].get("tags", [])
            if len(tags) > 5:
                # Limit to first 5 tags
                classification["arguments"]["tags"] = tags[:5]
                if DEBUG_MODE:
                    print(f"⚠️  Limited to first 5 tags: {tags[:5]}")
            elif len(tags) == 1:
                # Single tag - use simpler query
                classification["function_name"] = "get_projects_by_tags"
                classification["arguments"] = {"tag": tags[0]}
                if DEBUG_MODE:
                    print(f"✅ OVERRIDE: Single tag detected, using get_projects_by_tags")
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 0.8: COMPANY COMPARISON VALIDATION
        # ═══════════════════════════════════════════════════════════════
        
        if classification["function_name"] == "compare_opco_revenue":
            companies = classification["arguments"].get("companies", [])
            
            # If no companies specified or empty list, fallback to compare all companies
            if not companies or len(companies) == 0:
                if DEBUG_MODE:
                    print("⚠️  No specific companies provided for comparison")
                    print("✅ FALLBACK: Switching to compare_companies (all companies)")
                
                classification["function_name"] = "compare_companies"
                classification["arguments"] = {}
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 1: DATE CALCULATIONS (ENHANCED FOR COMBINED FILTERS)
        # ═══════════════════════════════════════════════════════════════
        
        # Try to parse month ranges first
        month_range = self.date_calculator.parse_month_range(user_question)
        if month_range:
            start_date, end_date = month_range
            
            if DEBUG_MODE:
                print(f"✅ Detected month range: {start_date} to {end_date}")
            
            classification["arguments"]["start_date"] = start_date
            classification["arguments"]["end_date"] = end_date
            
            # Don't override if it's already a combined filter or tag query
            if classification["function_name"] not in ["get_largest_by_tags", "get_projects_by_tags", 
                                                        "get_projects_by_multiple_tags", "get_projects_by_combined_filters"]:
                classification["function_name"] = "get_projects_by_date_range"
        
        # Try to parse relative dates
        if not month_range:
            date_range = self.date_calculator.parse_relative_date(user_question)
            
            if date_range:
                start_date, end_date = date_range
                
                if DEBUG_MODE:
                    print(f"✅ Detected relative date: {start_date} to {end_date}")
                
                # Add date filters to arguments
                classification["arguments"]["start_date"] = start_date
                classification["arguments"]["end_date"] = end_date
                
                # Override function ONLY if not already a special query type
                if classification["function_name"] not in ["get_largest_by_tags", "get_projects_by_multiple_tags", 
                                                            "get_projects_by_combined_filters"]:
                    if "largest" in user_question_lower or "top" in user_question_lower or "biggest" in user_question_lower:
                        classification["function_name"] = "get_largest_projects"
                    else:
                        classification["function_name"] = "get_projects_by_date_range"
                
                # Remove conflicting arguments
                classification["arguments"].pop("start_year", None)
                classification["arguments"].pop("end_year", None)
                classification["arguments"].pop("time_reference", None)
        
        # Check for specific quarter
        quarter_info = self.date_calculator.parse_specific_quarter(user_question)
        if quarter_info:
            year, quarter = quarter_info
            
            if DEBUG_MODE:
                print(f"✅ Detected quarter: Q{quarter} {year}")
            
            # Only override if not a combined filter
            if classification["function_name"] != "get_projects_by_combined_filters":
                classification["function_name"] = "get_projects_by_quarter"
                classification["arguments"]["year"] = year
                classification["arguments"]["quarter"] = quarter
        
        # Check for multiple years
        years = self.date_calculator.parse_multiple_years(user_question)
        if years:
            if DEBUG_MODE:
                print(f"✅ Detected multiple years: {years}")
            
            # Check if it's a comparison (only 2 years)
            if len(years) == 2 and any(word in user_question_lower for word in ["compare", "vs", "versus"]):
                if classification["function_name"] != "get_projects_by_combined_filters":
                    classification["function_name"] = "compare_years"
                    classification["arguments"]["year1"] = years[0]
                    classification["arguments"]["year2"] = years[1]
            else:
                if classification["function_name"] != "get_projects_by_combined_filters":
                    classification["function_name"] = "get_projects_by_years"
                    classification["arguments"]["years"] = years
        
        # Check for specific year (only if not a ranking query with relative time)
        elif not date_range and not month_range:
            year = self.date_calculator.parse_specific_year(user_question)
            if year:
                if DEBUG_MODE:
                    print(f"✅ Detected year: {year}")
                
                # If it's a "largest/top" query with a year
                if "largest" in user_question_lower or "top" in user_question_lower or "biggest" in user_question_lower:
                    if classification["function_name"] in ["get_largest_projects", "get_largest_by_tags", 
                                                            "get_projects_by_multiple_tags", "get_projects_by_combined_filters"]:
                        classification["arguments"]["start_year"] = year
                        classification["arguments"]["end_year"] = year
                else:
                    # Regular year query
                    if classification["function_name"] not in ["get_largest_projects", "get_smallest_projects", "get_largest_by_tags", 
                                                                "get_projects_by_tags", "get_projects_by_multiple_tags", "get_projects_by_combined_filters"]:
                        classification["function_name"] = "get_projects_by_year"
                        classification["arguments"]["year"] = year
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 2: NUMBER CALCULATIONS (FEE AMOUNTS)
        # ═══════════════════════════════════════════════════════════════
        
        # Parse fee range
        fee_range = self.number_calculator.parse_fee_range(user_question)
        if fee_range:
            min_fee, max_fee = fee_range
            
            if DEBUG_MODE:
                print(f"✅ Detected fee range: ${min_fee:,.2f} to ${max_fee or 'unlimited'}")
            
            # Add to arguments
            classification["arguments"]["min_fee"] = min_fee
            if max_fee:
                classification["arguments"]["max_fee"] = max_fee
            else:
                classification["arguments"]["max_fee"] = 999999999999  # Very large number
            
            # Override function ONLY if not already a special query type
            if classification["function_name"] not in ["get_projects_by_combined_filters", "get_largest_by_tags", 
                                                        "get_projects_by_multiple_tags"]:
                # If there's a client mentioned, use client_and_fee_range
                if "client" in classification["arguments"] or any(word in user_question_lower for word in ["tamu", "clid"]):
                    classification["function_name"] = "get_projects_by_client_and_fee_range"
                else:
                    classification["function_name"] = "get_projects_by_fee_range"
        
        # ═══════════════════════════════════════════════════════════════
        # STEP 3: LIMIT CALCULATIONS
        # ═══════════════════════════════════════════════════════════════
        
        # Parse limit
        limit = self.number_calculator.parse_limit(user_question)
        if limit:
            if DEBUG_MODE:
                print(f"✅ Detected limit: {limit}")
            
            classification["arguments"]["limit"] = limit
        
        if DEBUG_MODE:
            print(f"\n✅ Final classification after preprocessing: {classification}\n")
        
        return classification
    
    def build_sql_query(self, function_name: str, arguments: dict) -> tuple:
        """Build SQL query with parameters"""
        if function_name not in self.query_templates:
            return None, None
        
        template = self.query_templates[function_name]
        sql_query = template["sql"]
        
        # ═══════════════════════════════════════════════════════════════
        # SPECIAL HANDLING: COMBINED FILTERS QUERY
        # ═══════════════════════════════════════════════════════════════
        
        if function_name == "get_projects_by_combined_filters":
            params = []
            
            # Size filter
            size_filter = ""
            if "size" in arguments and arguments["size"]:
                size_case = self.size_calculator.get_sql_case_statement()
                size_filter = f"AND {size_case} ILIKE %s"
                params.append(f"%{arguments['size']}%")
            sql_query = sql_query.replace("{size_filter}", size_filter)
            
            # Category filter (multiple categories with OR)
            category_filter = ""
            if "categories" in arguments and arguments["categories"]:
                categories = arguments["categories"]
                if isinstance(categories, list) and len(categories) > 0:
                    category_conditions = []
                    for cat in categories:
                        category_conditions.append('"Request Category" ILIKE %s')
                        params.append(f"%{cat}%")
                    category_filter = f"AND ({' OR '.join(category_conditions)})"
            sql_query = sql_query.replace("{category_filter}", category_filter)
            
            # Tag filter (multiple tags with AND - must have all)
            tag_filter = ""
            if "tags" in arguments and arguments["tags"]:
                tags = arguments["tags"]
                if isinstance(tags, list) and len(tags) > 0:
                    tag_conditions = []
                    for tag in tags:
                        tag_conditions.append('"Tags" ILIKE %s')
                        params.append(f"%{tag}%")
                    tag_filter = f"AND {' AND '.join(tag_conditions)}"
            sql_query = sql_query.replace("{tag_filter}", tag_filter)
            
            # Status filter
            status_filter = ""
            if "status" in arguments and arguments["status"]:
                status_filter = 'AND "Status" ILIKE %s'
                params.append(f"%{arguments['status']}%")
            sql_query = sql_query.replace("{status_filter}", status_filter)
            
            # Company filter
            company_filter = ""
            if "company" in arguments and arguments["company"]:
                company_filter = 'AND "Company" ILIKE %s'
                params.append(f"%{arguments['company']}%")
            sql_query = sql_query.replace("{company_filter}", company_filter)
            
            # State filter
            state_filter = ""
            if "state_code" in arguments and arguments["state_code"]:
                state_filter = 'AND "State Lookup" = %s'
                params.append(str(arguments["state_code"]))
            sql_query = sql_query.replace("{state_filter}", state_filter)
            
            # Fee filter
            fee_filter = ""
            if "min_fee" in arguments and arguments["min_fee"]:
                fee_filter = 'AND CAST(NULLIF("Fee", \'\') AS NUMERIC) >= %s'
                params.append(float(arguments["min_fee"]))
            if "max_fee" in arguments and arguments["max_fee"]:
                fee_filter += ' AND CAST(NULLIF("Fee", \'\') AS NUMERIC) <= %s'
                params.append(float(arguments["max_fee"]))
            sql_query = sql_query.replace("{fee_filter}", fee_filter)
            
            # Win rate filter
            win_filter = ""
            if "min_win" in arguments and arguments["min_win"]:
                win_filter = 'AND CAST(NULLIF("Win %", \'\') AS NUMERIC) >= %s'
                params.append(int(arguments["min_win"]))
            if "max_win" in arguments and arguments["max_win"]:
                win_filter += ' AND CAST(NULLIF("Win %", \'\') AS NUMERIC) <= %s'
                params.append(int(arguments["max_win"]))
            sql_query = sql_query.replace("{win_filter}", win_filter)
            
            # Date filter
            date_filter = ""
            if "start_date" in arguments and arguments["start_date"]:
                date_filter = 'AND "Start Date" >= %s::date'
                params.append(arguments["start_date"])
            if "end_date" in arguments and arguments["end_date"]:
                date_filter += ' AND "Start Date" <= %s::date'
                params.append(arguments["end_date"])
            sql_query = sql_query.replace("{date_filter}", date_filter)
            
            # Limit clause
            limit_clause = ""
            if "limit" in arguments and arguments["limit"]:
                try:
                    limit_value = int(arguments["limit"])
                    limit_clause = f"LIMIT {limit_value}"
                except (ValueError, TypeError):
                    pass
            sql_query = sql_query.replace("{limit_clause}", limit_clause)
            
            if DEBUG_MODE:
                print(f"🔍 DEBUG - Combined filters query built")
                print(f"🔍 DEBUG - Filters applied: {list(arguments.keys())}")
                print(f"🔍 DEBUG - Params count: {len(params)}")
            
            return sql_query, tuple(params)
        
        # ═══════════════════════════════════════════════════════════════
        # REGULAR QUERY PROCESSING
        # ═══════════════════════════════════════════════════════════════

        # Handle dynamic size categorization
        if "{size_case_statement}" in sql_query:
            size_case = self.size_calculator.get_sql_case_statement()
            sql_query = sql_query.replace("{size_case_statement}", size_case)
            
            if DEBUG_MODE:
                print(f"🔍 DEBUG - Injected dynamic size categories")
        
        if DEBUG_MODE:
            print(f"\n🔍 DEBUG - Function: {function_name}")
            print(f"🔍 DEBUG - Arguments received: {arguments}")
        
        # Handle dynamic date filtering for {date_filter}
        if "{date_filter}" in sql_query:
            date_filter = ""
            
            if "start_date" in arguments and "end_date" in arguments:
                start_date = arguments["start_date"]
                end_date = arguments["end_date"]
                date_filter = f"AND \"Start Date\" >= '{start_date}'::date AND \"Start Date\" <= '{end_date}'::date AND \"Start Date\" > '2000-01-01'"
            
            elif "start_year" in arguments and "end_year" in arguments:
                start_year = arguments["start_year"]
                end_year = arguments["end_year"]
                date_filter = f"AND \"Start Date\" >= '{start_year}-01-01'::date AND \"Start Date\" <= '{end_year}-12-31'::date AND \"Start Date\" > '2000-01-01'"
            
            sql_query = sql_query.replace("{date_filter}", date_filter)
        
        # Handle status_filter for revenue_by_category
        if "{status_filter}" in sql_query:
            status_filter = ""
            if "status" in arguments and arguments["status"]:
                status_filter = f"AND \"Status\" ILIKE '%{arguments['status']}%'"
            sql_query = sql_query.replace("{status_filter}", status_filter)
        
        # Handle dynamic limit clause
        if "{limit_clause}" in sql_query:
            limit_clause = ""
            if "limit" in arguments and arguments["limit"]:
                try:
                    limit_value = int(arguments["limit"])
                    limit_clause = f"LIMIT {limit_value}"
                    if DEBUG_MODE:
                        print(f"🔍 DEBUG - Applying LIMIT: {limit_value}")
                except (ValueError, TypeError):
                    pass
            sql_query = sql_query.replace("{limit_clause}", limit_clause)
        
        # Handle max_fee_filter
        if "{max_fee_filter}" in sql_query:
            max_fee_filter = ""
            if "max_fee" in arguments and arguments["max_fee"]:
                try:
                    max_fee_value = float(arguments["max_fee"])
                    if max_fee_value < 999999999999:
                        max_fee_filter = f"AND CAST(\"Fee\" AS NUMERIC) <= {max_fee_value}"
                except (ValueError, TypeError):
                    pass
            sql_query = sql_query.replace("{max_fee_filter}", max_fee_filter)
        
        # Build parameters
        params = []
        if "params" in template and len(template["params"]) > 0:
            param_types = template.get("param_types", [])
            
            for idx, param_name in enumerate(template["params"]):
                param_type = param_types[idx] if idx < len(param_types) else "str"
                
                # Handle state_code specially (exact match, no wildcards)
                if param_name == "state_code":
                    val = arguments.get(param_name, "")
                    params.append(str(val))
                    if DEBUG_MODE:
                        print(f"🔍 DEBUG - {param_name} parameter: '{val}'")
                    continue
                
                # Handle status field specially (use wildcard for partial matching)
                if param_name == "status":
                    val = arguments.get(param_name, "")
                    value = f"%{val}%"
                    params.append(value)
                    if DEBUG_MODE:
                        print(f"🔍 DEBUG - Status parameter: '{value}'")
                    continue
                
                # Handle min_win, max_win specially (integer thresholds)
                if param_name in ["min_win", "max_win"]:
                    val = arguments.get(param_name, 0)
                    try:
                        value = int(val)
                        params.append(value)
                        if DEBUG_MODE:
                            print(f"🔍 DEBUG - {param_name} parameter: {value}")
                    except (ValueError, TypeError):
                        params.append(0)
                    continue
                
                # Handle project_name/internal_id/reference fields
                if param_name in ["project_name", "internal_id", "reference_client", "reference_project"]:
                    val = arguments.get(param_name, "")
                    if not val and param_name in ["reference_project", "internal_id"]:
                        val = arguments.get("project_name", "")
                    if not val and param_name == "reference_client":
                        val = arguments.get("client", "")
                    value = f"%{val}%"
                    params.append(value)
                    if DEBUG_MODE:
                        print(f"🔍 DEBUG - {param_name} parameter: '{value}'")
                    continue
                
                # Get parameter value
                if param_name in arguments:
                    param_value = arguments[param_name]
                    
                    if param_type == "int":
                        try:
                            value = int(param_value)
                            params.append(value)
                            if DEBUG_MODE:
                                print(f"🔍 DEBUG - {param_name} (int) parameter: {value}")
                        except (ValueError, TypeError):
                            params.append(0)
                    
                    elif param_type == "float":
                        try:
                            value = float(param_value)
                            params.append(value)
                            if DEBUG_MODE:
                                print(f"🔍 DEBUG - {param_name} (float) parameter: {value}")
                        except (ValueError, TypeError):
                            params.append(0.0)
                    
                    elif param_type == "array":
                        if isinstance(param_value, list):
                            if len(param_value) == 0:
                                if DEBUG_MODE:
                                    print(f"⚠️  Empty array for parameter '{param_name}'")
                                params.append([])
                            else:
                                if param_name in ["categories", "companies"]:
                                    array_values = [f"%{str(v).strip()}%" for v in param_value]
                                    params.append(array_values)
                                    if DEBUG_MODE:
                                        print(f"🔍 DEBUG - {param_name} (array) parameter: {array_values}")
                                else:
                                    params.append(param_value)
                                    if DEBUG_MODE:
                                        print(f"🔍 DEBUG - {param_name} (array) parameter: {param_value}")
                        else:
                            if param_name in ["categories", "companies"]:
                                params.append([f"%{str(param_value).strip()}%"])
                            else:
                                params.append([param_value])
                    
                    elif param_type == "str":
                        if param_value == "" or param_value is None:
                            params.append("%%")
                        else:
                            value = f"%{param_value}%"
                            params.append(value)
                            if DEBUG_MODE:
                                print(f"🔍 DEBUG - {param_name} (str) parameter: '{value}'")
                    
                    else:
                        params.append(param_value)
                
                else:
                    # Parameter not provided
                    if DEBUG_MODE:
                        print(f"⚠️  Parameter '{param_name}' not provided in arguments")
                    
                    if param_type == "int":
                        params.append(0)
                    elif param_type == "float":
                        params.append(0.0)
                    elif param_type == "array":
                        params.append([])
                    else:
                        params.append("%%")
            
            if DEBUG_MODE:
                print(f"🔍 DEBUG - Final params list: {params}")
                print(f"🔍 DEBUG - Params count: {len(params)}")
                print(f"🔍 DEBUG - Params types: {[type(p).__name__ for p in params]}")
            
            # Convert to tuple properly
            # Check if we have array parameters that need special handling
            has_array_param = any(isinstance(p, list) for p in params)
            
            if has_array_param and len(params) == 1:
                # Single array parameter case
                result_tuple = (params[0],)
            else:
                # Regular case - convert list to tuple
                result_tuple = tuple(params)
            
            if DEBUG_MODE:
                print(f"🔍 DEBUG - Result tuple: {result_tuple}")
                print(f"🔍 DEBUG - Result tuple type: {type(result_tuple)}")
                print(f"🔍 DEBUG - Result tuple length: {len(result_tuple)}")
            
            return sql_query, result_tuple
        
        return sql_query, None
    
    def execute_query(self, function_name: str, arguments: dict) -> dict:
        """Execute SQL query and return results"""
        try:
            sql_query, params = self.build_sql_query(function_name, arguments)
            
            if sql_query is None:
                return {
                    "success": False,
                    "error": f"Unknown function: {function_name}",
                    "data": [],
                    "row_count": 0
                }
            
            if DEBUG_MODE:
                print(f"\n🔍 DEBUG - FULL SQL Query:")
                print("="*80)
                print(sql_query)
                print("="*80)
                
                placeholder_count = sql_query.count('%s')
                param_count = len(params) if params else 0
                
                print(f"\n🔍 DEBUG - Placeholder Analysis:")
                print(f"   Placeholders (%s) found in SQL: {placeholder_count}")
                print(f"   Parameters provided: {param_count}")
                print(f"   Match: {'✓ YES' if placeholder_count == param_count else '✗ NO - MISMATCH!'}")
                
                print(f"\n🔍 DEBUG - Params: {params}")
                print(f"🔍 DEBUG - Params type: {type(params)}")
                
                # Additional validation
                if params:
                    print(f"🔍 DEBUG - Individual param types:")
                    for i, p in enumerate(params):
                        print(f"   params[{i}] = {repr(p)} (type: {type(p).__name__})")
            
            # Connect to database
            conn = psycopg2.connect(**DB_CONFIG)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Execute query with proper parameter handling
            try:
                if params is not None and len(params) > 0:
                    if DEBUG_MODE:
                        print(f"\n🔍 DEBUG - Executing with params...")
                    cursor.execute(sql_query, params)
                else:
                    if DEBUG_MODE:
                        print(f"\n🔍 DEBUG - Executing without params...")
                    cursor.execute(sql_query)
            except Exception as exec_error:
                if DEBUG_MODE:
                    print(f"\n🔍 DEBUG - Execute error details:")
                    print(f"   Error type: {type(exec_error).__name__}")
                    print(f"   Error message: {str(exec_error)}")
                    print(f"   SQL query: {sql_query}")
                    print(f"   Params: {params}")
                    
                    # Try to diagnose the issue
                    if params:
                        print(f"\n🔍 DEBUG - Attempting manual parameter substitution test:")
                        try:
                            # Test if the issue is with psycopg2 parameter format
                            test_query = sql_query
                            for i, param in enumerate(params):
                                if isinstance(param, str):
                                    test_query = test_query.replace('%s', f"'{param}'", 1)
                                else:
                                    test_query = test_query.replace('%s', str(param), 1)
                            print(f"   Manual substitution would create: {test_query[:200]}...")
                        except Exception as test_error:
                            print(f"   Test failed: {test_error}")
                
                raise exec_error
            
            # Fetch results
            results = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            # Convert to list of dicts
            data = []
            for row in results:
                row_dict = dict(row)
                
                # Convert datetime objects to strings
                for key, value in row_dict.items():
                    if isinstance(value, datetime):
                        row_dict[key] = value.isoformat()
                
                data.append(row_dict)
            
            if DEBUG_MODE:
                print(f"\n🔍 DEBUG - Converted {len(results)} rows to JSON successfully")
                if len(results) > 0:
                    print(f"🔍 DEBUG - Sample keys: {list(data[0].keys())[:5]}...")
            
            template = self.query_templates[function_name]
            
            return {
                "success": True,
                "data": data,
                "row_count": len(data),
                "chart_type": template.get("chart_type", "none"),
                "chart_field": template.get("chart_field", None)
            }
        
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            
            if DEBUG_MODE:
                print(f"\n🔍 DEBUG - ERROR occurred:")
                print(error_trace)
            
            return {
                "success": False,
                "error": str(e),
                "traceback": error_trace,
                "data": [],
                "row_count": 0
            }
    
    def generate_chart_config(self, results: dict, function_name: str) -> dict:
        """Generate chart configuration for frontend"""
        if not results["success"] or results["row_count"] == 0:
            return None
        
        chart_type = results.get("chart_type", "none")
        if chart_type == "none":
            return None
        
        chart_field = results.get("chart_field")
        data = results["data"]
        
        try:
            if chart_type == "bar":
                # Bar chart - limit to top 20 for visualization
                limited_data = data[:20]
                
                labels = []
                values = []
                
                for item in limited_data:
                    # Determine label
                    if "Project Name" in item:
                        label = str(item.get("Project Name", "Unknown"))[:30]
                    elif "Company" in item:
                        label = item.get("Company", "Unknown")
                    elif "tag" in item:
                        label = item.get("tag", "Unknown").strip()
                    elif "Status" in item:
                        label = item.get("Status", "Unknown")
                    elif "size_tier" in item:
                        label = item.get("size_tier", "Unknown")
                    elif "year" in item:
                        label = str(item.get("year", "Unknown"))
                    else:
                        label = "Item"
                    
                    labels.append(label)
                    
                    # Determine value
                    if chart_field and chart_field in item:
                        value = item.get(chart_field, 0)
                        values.append(float(value) if value else 0)
                    elif "Fee" in item:
                        fee = item.get("Fee", 0)
                        values.append(float(fee) if fee else 0)
                    else:
                        values.append(0)
                
                return {
                    "type": "bar",
                    "title": f"Top {len(limited_data)} Results",
                    "labels": labels,
                    "datasets": [{
                        "label": chart_field or "Fee",
                        "data": values,
                        "backgroundColor": "rgba(54, 162, 235, 0.6)",
                        "borderColor": "rgba(54, 162, 235, 1)",
                        "borderWidth": 1
                    }]
                }
            
            elif chart_type == "pie":
                # Pie chart for distribution
                labels = []
                values = []
                
                for item in data:
                    if "Status" in item:
                        labels.append(item.get("Status", "Unknown"))
                    elif "size_tier" in item:
                        labels.append(item.get("size_tier", "Unknown"))
                    else:
                        labels.append("Category")
                    
                    if chart_field and chart_field in item:
                        value = item.get(chart_field, 0)
                        values.append(float(value) if value else 0)
                    else:
                        values.append(1)
                
                return {
                    "type": "pie",
                    "title": "Distribution",
                    "labels": labels,
                    "datasets": [{
                        "data": values,
                        "backgroundColor": [
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                            'rgba(255, 159, 64, 0.6)',
                            'rgba(199, 199, 199, 0.6)',
                            'rgba(83, 102, 255, 0.6)',
                            'rgba(255, 99, 255, 0.6)',
                            'rgba(99, 255, 132, 0.6)'
                        ]
                    }]
                }
        
        except Exception as e:
            if DEBUG_MODE:
                print(f"Chart generation error: {str(e)}")
            return None
    
    def calculate_summary_stats(self, data: List[dict]) -> dict:
        """Calculate summary statistics"""
        if not data:
            return {}
        
        stats = {
            "total_records": len(data)
        }
        
        # Fee statistics
        fees = []
        for item in data:
            if "Fee" in item and item["Fee"]:
                try:
                    fees.append(float(item["Fee"]))
                except (ValueError, TypeError):
                    pass
        
        if fees:
            stats["total_value"] = sum(fees)
            stats["avg_fee"] = sum(fees) / len(fees)
            stats["median_fee"] = sorted(fees)[len(fees) // 2]
            stats["min_fee"] = min(fees)
            stats["max_fee"] = max(fees)
        
        # Win rate statistics
        win_rates = []
        for item in data:
            win_field = item.get("Win_Percentage") or item.get("Win %") or item.get("Win %")
            if win_field:
                try:
                    win_rates.append(float(win_field))
                except (ValueError, TypeError):
                    pass
        
        if win_rates:
            stats["avg_win_rate"] = sum(win_rates) / len(win_rates)
        
        # Status breakdown
        status_counts = {}
        for item in data:
            if "Status" in item:
                status = item["Status"]
                status_counts[status] = status_counts.get(status, 0) + 1
        
        if status_counts:
            stats["status_breakdown"] = status_counts
        
        # Company breakdown
        company_counts = {}
        for item in data:
            if "Company" in item:
                company = item["Company"]
                company_counts[company] = company_counts.get(company, 0) + 1
        
        if company_counts:
            # Top 5 companies
            sorted_companies = sorted(company_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            stats["top_companies"] = dict(sorted_companies)
        
        return stats
    
    def process_query(self, user_question: str) -> dict:
        """Main query processing with comprehensive preprocessing"""
        
        # Step 1: Classify query with LLM (text understanding only)
        classification = self.openai_client.classify_query(user_question, self.function_definitions)
        
        if classification.get("function_name") == "none" or classification.get("function_name") is None:
            return {
                "success": False,
                "error": "cannot_classify",
                "message": f"Could not understand the question: '{user_question}'. Please try rephrasing.",
                "data": [],
                "summary": {},
                "chart_config": None
            }
        
        # Step 2: Preprocess to handle ALL calculations (dates, numbers, limits)
        classification = self.preprocess_query(user_question, classification)
        
        function_name = classification["function_name"]
        arguments = classification["arguments"]
        
        # Step 3: Execute query
        results = self.execute_query(function_name, arguments)
        
        if not results["success"]:
            return {
                "success": False,
                "error": results.get("error", "Query execution failed"),
                "message": "An error occurred while executing the query",
                "traceback": results.get("traceback", ""),
                "data": [],
                "summary": {},
                "chart_config": None
            }
        
        # Step 4: Generate chart and summary
        chart_config = self.generate_chart_config(results, function_name)
        summary = self.calculate_summary_stats(results["data"])
        
        return {
            "success": True,
            "question": user_question,
            "function_name": function_name,
            "arguments": arguments,
            "data": results["data"],
            "row_count": results["row_count"],
            "summary": summary,
            "chart_config": chart_config,
            "message": f"Found {results['row_count']} results"
        }


# Initialize query engine globally
query_engine = None


def lambda_handler(event, context):
    """
    AWS Lambda handler function
    
    Expected event structure:
    {
        "question": "Top 10 projects in last 6 months"
    }
    
    Or for API Gateway:
    {
        "body": "{\"question\": \"Top 10 projects in last 6 months\"}"
    }
    """
    global query_engine
    
    # Initialize query engine on cold start
    if query_engine is None:
        query_engine = QueryEngine()

    try:
        # Parse input
        if "body" in event:
            # API Gateway format
            body = json.loads(event["body"]) if isinstance(event["body"], str) else event["body"]
            question = body.get("question", "")
        else:
            # Direct Lambda invocation
            question = event.get("question", "")
        
        if not question:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "POST, OPTIONS"
                },
                "body": json.dumps({
                    "success": False,
                    "error": "missing_question",
                    "message": "Please provide a 'question' parameter"
                })
            }
        
        # Process query
        response = query_engine.process_query(question)
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            },
            "body": json.dumps(response, default=str)
        }
    
    except Exception as e:
        import traceback
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            },
            "body": json.dumps({
                "success": False,
                "error": "internal_error",
                "message": str(e),
                "traceback": traceback.format_exc()
            })
        }


# For local testing
if __name__ == "__main__":
    # Test locally
    query_engine = QueryEngine()
    
    test_questions = [
        "can you show me all mega sized projects starting in the next ten months which are transportation related?",
    ]
    
    for question in test_questions:
        print(f"\n{'='*80}")
        print(f"Question: {question}")
        print('='*80)
        
        response = query_engine.process_query(question)
        
        # Print summary
        print(f"\n✅ Success: {response['success']}")
        print(f"📊 Row Count: {response.get('row_count', 0)}")
        print(f"🔧 Function Called: {response.get('function_name', 'N/A')}")
        print(f"📝 Arguments: {json.dumps(response.get('arguments', {}), indent=2)}")
        
        if response['success']:
            # Print summary statistics
            if response.get('summary'):
                print(f"\n📈 SUMMARY STATISTICS:")
                print(f"{'='*80}")
                summary = response['summary']
                
                if 'total_records' in summary:
                    print(f"Total Records: {summary['total_records']}")
                
                if 'total_value' in summary:
                    print(f"Total Value: ${summary['total_value']:,.2f}")
                
                if 'avg_fee' in summary:
                    print(f"Average Fee: ${summary['avg_fee']:,.2f}")
            
            # Save to JSON file
            print(f"\n💾 SAVE TO FILE:")
            print(f"{'='*80}")
            filename = f"query_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(response, f, indent=2, default=str)
            print(f"✅ Full results saved to: {filename}")
        
        else:
            print(f"\n❌ Error: {response.get('error', 'Unknown')}")
            if response.get('message'):
                print(f"Message: {response['message']}")